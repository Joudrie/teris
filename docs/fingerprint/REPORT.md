# UI fingerprint audit: Tumbledown vs Cartopia

**Scope:** diagnosis only. No game code, CSS or assets were changed.

**Measured** on 2026-10-15, Tumbledown build `b71b3c47f1` against Cartopia `main`, run locally with no backend keys.

**Method.** Every visible element on 12 Tumbledown screens and 13 Cartopia screens was read with `getComputedStyle` at 390 × 844 (2×) and 1440 × 900. A dump of every value is in [tokens.json](tokens.json). The values were cross-checked against `style.css` (Tumbledown) and `src/index.css` / `src/theme.css` (Cartopia). Where code and render disagree, the render wins.

**Evidence:**
- Full screens: [tumbledown/](tumbledown/) and [cartopia/](cartopia/), named `phone-*` and `desktop-*`.
- Side-by-side pairs: [pairs/](pairs/). `screen-*` are whole screens; `crop-*` are the same component cropped from each game at 3×.

**Coverage:**
- **Tumbledown:** play, tutorial callout, tower map, pause, settings, shop, daily gifts, blocks codex, level card, win, lose (revive) and toast.
- **Cartopia:** town home and HUD, shop, cars/garage, showroom, gifts, goals, deals, bank, inventory, account, season and race (hub and daily). Cartopia has no reachable win/lose screen outside a race, so its result-screen comparison uses the deals offer screen.

## The short answer

The two games share one design system. It differs only in a few hex digits and a pixel here and there.

**They match on everything structural:**
- the two fonts
- the navy outline on every element
- the button construction (gradient face, light inset line on top, dark inset lip at the bottom, hard drop)
- the green / red / gold / navy role colors
- the white outlined display text
- the red X close button in the panel's top-right corner
- the navy coin pill
- the white list card with a green price chip on the right
- the ribbon tag that straddles a card's top edge
- the overshoot pop-in curve

What Tumbledown owns is the game itself (voxel blocks, steam, the tower map, the gold well frame) and a few layout decisions. It owns none of the UI vocabulary.

## Master table

Verdicts: **FP** = default fingerprint (replace), **GC** = genre convention (shared, but also standard in top-grossing casual games; replacing it is optional), **OWN** = Tumbledown's own.

### Typography

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Display font | Lilita One 400, self-hosted (`style.css:5`), on 177 of 193 text elements | Lilita One 400 via Google Fonts (`index.html:43`), on 209 of 261 | **FP** | tokens.json `fonts`; every crop |
| UI/body font | Nunito 700–800, self-hosted (`style.css:6`) | Nunito 600/800/900, body font (`src/index.css:17`) | **FP** | `p.note` vs `card-stat` |
| Display fallback stack | `'Arial Rounded MT Bold', system-ui` | `'Arial Black', Impact` | – (invisible) | `--display` in both |
| Type scale | Display 11, 12, 13, 14, 15, 16, 17, 18, 22, 24, 30, 34, 38, 44, 46; UI 12–16 | Display 10–16 (mostly 12–14), 18, 20, 26, 29 | **FP** (same small-label band, same ~30 px panel titles) | aggregate `size_by_font` |
| Panel title | 30 px Lilita, white, centered | 29–32 px Lilita, white, left-aligned | **FP** (alignment differs) | [crop-panel-header](pairs/crop-panel-header.jpg) |
| Title outline method | 8-direction `text-shadow` 2 px `#0d1640` plus a drop `0 4px 0 rgba(13,22,64,.45)` (`style.css:66`) | `-webkit-text-stroke` 5–6 px `#14213d`, `paint-order: stroke fill`, drop `0 4px 0 #14213d` (`theme.css:74`) | **FP**: different code, identical look | [crop-panel-header](pairs/crop-panel-header.jpg), [crop-go-button-hud](pairs/crop-go-button-hud.jpg) |
| Small label outline | the same 8-way `.t` outline on all game text (100 elements) | `0 2px 0 #14213d` or `0 1px 0 rgba(0,0,0,.5)` | **FP** | aggregate `tshadow` |
| Letter spacing | 0.5 px (display), 1 px (caps labels) | 0.3–0.6 px | **FP** | aggregate `ls` |
| All-caps labels | 56 elements (GOAL, PIECES, NEXT, LEVEL 1) | 2 elements; ribbons and tabs are mixed case | **OWN-ish** (Tumbledown leans harder on caps) | phone-play, phone-home |
| Text colors | White on 129 elements; gold `#ffd85c`; pale blues `#c4d4ff` / `#b8c8ff`; ink on light cards | White on 192; dark `#1f2a33` / `#14213d` on light cards; purple accent `#5e35b1` | **FP** (white outlined on dark chrome, ink on light cards) | aggregate `color` |
| Number style | proportional Lilita digits (`17`, `0/20`, `150`) | proportional Lilita digits (`250K`, `$1,000`) | **FP** | [crop-counter-pill](pairs/crop-counter-pill.jpg) |
| Copy voice | short, exclamation-heavy ("Level cleared!", "So close! 90%", "Quest done!") | short, exclamation-heavy ("Friends helped you!", "START HERE") | **GC** (casual-genre voice) | screens |

### Color

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Outline ink | `#0d1640` | `#14213d` (`--line`), `#1b2a4a` (`--ink`) | **FP**: both are very dark navy, not black or brown | tokens.json `colors` |
| Primary "go" green | `#8ff060 → #45c41e`, lip `#2a8a12` | `#8ef05c → #2fae35`, lip `rgba(0,0,0,.18)` | **FP**: top stop nearly identical (`#8ff060` vs `#8ef05c`) | [crop-primary-button](pairs/crop-primary-button.jpg) |
| Close / danger red | `#ff6b5a → #e2362a` | `#ff6b6b → #d6283b` | **FP**: same `#ff6b..` top stop | [crop-close-button](pairs/crop-close-button.jpg) |
| Navy chrome | `#33509f → #23377f` (panels, icon buttons, boosters, next, quest) | `#34507f → #1f3358` (pills, goal tracker), `#2a4370 → #1c2e52` (HUD strip) | **FP**: `#3350..` vs `#3450..` | [crop-hud-top](pairs/crop-hud-top.jpg) |
| Secondary blue | `#6fb0ff → #2f74e8` | `#5aa9ff → #2263d6` (panel header), `--blue #2f7ff0` | **FP** | [crop-panel-header](pairs/crop-panel-header.jpg) |
| Reward gold | `#ffd85c → #f2a516`, disc `#fff1a8 / #ffc83a / #e8960c` | `#ffd84a → #f0a400`, `#ffd43b → #ff9f1a` | **FP**: `#ffd85c` vs `#ffd84a` | tokens.json `gradients` |
| Light card surface | `#f4f8ff → #dfe8ff`, lip `#c5d3f0` | `#ffffff` / `#f2f4f7`, border and lip `#c6d7ee` | **FP**: `#c5d3f0` vs `#c6d7ee` | [crop-list-card](pairs/crop-list-card.jpg) |
| Modal backdrop | `rgba(13,22,64,.55)` | `rgba(10,22,48,.55)` | **FP**: same alpha, near-same navy | `#sheet` vs `.overlay` |
| Pill / track fill | `rgba(13,22,64,.6)`, track `#0f1a4a` | `rgba(0,0,0,.25)`, navy gradient | **FP** | [crop-counter-pill](pairs/crop-counter-pill.jpg) |
| Accent extras | aqua goal bar `#8ff0ff → #27c4ff`; pink showcase node | per-action icon colors (orange, red, purple, pink, teal) | **OWN** (Tumbledown's aqua goal bar; Cartopia's rainbow dock) | phone-play vs phone-home |
| Page background | sky `#2f8ef0`, altitude gradient, round sun, puffy clouds | 3D town; splash with sun and conic rays | **OWN** (Tumbledown's sky tower world) | screen-home |
| Value structure | darkest: board well and ink; then navy chrome; then gold and green actions; lightest: sky and light cards | darkest: ink; then navy HUD; then colorful buttons; lightest: light panel bodies | **FP** | screens |
| Hue count and saturation | about 7 hues, all at full candy saturation | about 9 hues, full candy saturation | **FP** | aggregate `gradient` |

### Shape and depth

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Outline width | 3 px on 250 elements, 2 px on 46 | 2 px on 217, 3 px on 50, 4 px on panels | **FP** | aggregate `border` |
| Radius scale | 12 / 16 / 20 / 22 / 26, pills 22, chips 8–10, circles 50% | 12 / 14 / 16 / 18 / 22, pills 999, chips 9–12, circles 50% | **FP**: the same 12–22 band, never square, never fully pill-shaped buttons | tokens.json `shape` |
| Button construction | `inset 0 4px 0 rgba(255,255,255,.5)`, `inset 0 -8px 0 <darker lip>`, `0 4px 0 rgba(13,22,64,.35)` | `inset 0 3px 0 rgba(255,255,255,.45)`, `inset 0 -6px 0 rgba(0,0,0,.18)`, `0 5px 0 rgba(0,0,0,.35)` | **FP**: the single most shared trait | [crop-go-button-hud](pairs/crop-go-button-hud.jpg) |
| Panel depth | `inset 0 3px 0 rgba(255,255,255,.22)`, `inset 0 -5px 0 rgba(0,0,0,.25)`, `0 4px 0` | panel `0 8px 0 rgba(0,0,0,.35)`, `0 20px 40px`; strips `inset 0 2px 0 rgba(255,255,255,.18)`, `0 4px 0` | **FP** | aggregate `shadow` |
| Lip depth | 8 px rest, 4 px pressed (`--lip`) | 5–6 px | **FP** | `style.css:96` |
| Press state | `translateY(4px)`, lip shrinks, 120 ms ease-out | `translateY(3px)`, lip shrinks (`theme.css` `.icon-btn:active`) | **FP** | tokens.json `shadows` |
| Drop shadow | hard, 0 blur, 4 px, ink at 35% | hard, 0 blur, 2–5 px, black at 35% | **FP** | aggregate `shadow` |
| Disabled | `grayscale(.8) brightness(.85)` | greyed | **GC** | – |
| Focus | 3 px white outline, 3 px offset | (not styled in the screens read) | – | `style.css:98` |

### Components

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Primary button | green, 80 px tall, radius 20, 3 px ink, Lilita 34 px white outlined | green, 44–54 px, radius 14–18, 2 px ink, Lilita 13–20 px white | **FP** | [crop-primary-button](pairs/crop-primary-button.jpg), [crop-go-button-hud](pairs/crop-go-button-hud.jpg) |
| Close button | 40 px, radius 12, red gradient, white X, panel top-right | 44 px, radius 12, red gradient, white X, panel top-right | **FP**: indistinguishable | [crop-close-button](pairs/crop-close-button.jpg) |
| Icon button | 52 px, radius 16, navy face, glyph, label under | 48 px in a 62 px button, radius 14–16, colored face, glyph, caps label under | **FP** | [crop-icon-button](pairs/crop-icon-button.jpg) |
| Counter pill | 42 px, radius 22, translucent navy, 3 px ink, gold coin left, Lilita number | 22–30 px, radius 12–14, navy, gold coin left, Lilita number | **FP** | [crop-counter-pill](pairs/crop-counter-pill.jpg) |
| Panel / sheet | centered card up to 380 px, navy, radius 20, centered title, pop-in 340 ms | full-width bottom sheet, light body, blue header bar, 4 px ink, radius 22 top, slide-up 300 ms | **FP** for the title and close-button anatomy; **OWN** for Tumbledown's centered card | [crop-panel-header](pairs/crop-panel-header.jpg), [screen-menu-shop](pairs/screen-menu-shop.jpg) |
| List card | light `#f4f8ff`, 3 px ink, radius 16, lip `#c5d3f0`, icon left, name, line, green price right | white, 2 px `#c6d7ee`, radius 14, thumbnail left, name, line, green price right | **FP**: same anatomy | [crop-list-card](pairs/crop-list-card.jpg) |
| Price chip | green gradient, 2 px ink, radius 10, Lilita 15 px | green gradient, 2 px dark green, radius 12, Lilita 14 px | **FP** | [crop-list-card](pairs/crop-list-card.jpg) |
| Ribbon tag | red, radius 8, Lilita 11 px, straddles the card top | orange, radius 9, Lilita 12 px caps, straddles the card top | **FP** | [crop-ribbon-tag](pairs/crop-ribbon-tag.jpg) |
| Toggle / segmented | blue press tile 160 × 56 with a switch | green press tile 176 × 40; yellow selected tab with ink outline | **FP** (state shown by face color on a press tile) | [crop-toggle](pairs/crop-toggle.jpg), [crop-tabs-or-segments](pairs/crop-tabs-or-segments.jpg) |
| Progress bar | 16 px, radius 10, dark track with stripes, aqua fill, inside a navy panel | thin bar inside a 30 px navy pill (goal tracker); yellow fuel bar | **FP** for the container; **OWN** for the aqua striped fill | phone-play, phone-home |
| Badges / dots | blue count dot with 2 px ink; red "1" dot | red dot with 2 px white border | **GC** | phone-home both |
| Banner ribbon | red title bar, radius 14, Lilita 38 px (win); blue (lose) | blue header bar on every panel | **GC** (Royal Match does this too), but same build-up | phone-win |
| Toast | green pill, Lilita 18 px, drops from the top | (not reached) | – | phone-toast |
| Callout | white card, ink outline, lip, hand gesture | tooltips (`TapTip`) | **GC** | phone-callout |
| Star rating | three gold stars, middle larger, ink outline, white shine | stars as icons in rows | **GC** | phone-win |
| Map node | gold disc, ink outline, blue current node with pulse | – | **OWN** | phone-home |
| HUD top bar | separate pieces: pause button, goal panel, gold pieces badge | one navy strip containing speedo, chips and buttons | **FP** for the materials (navy plus gold plus ink); **OWN** for the split layout | [crop-hud-top](pairs/crop-hud-top.jpg) |
| Bottom bar | next tray, quest chip, round power button | dock of colored icon buttons plus a green RACE button | **OWN** (layout) / **FP** (materials) | screen-hud |

### Icons

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Drawing | filled glyphs, 2.6 px ink stroke via `paint-order: stroke`, white highlight shape, 24 grid (`src/ui/icons.js`) | filled `.gi` glyphs with a drop shadow, plus emoji in copy (sparkles, magnifier, lock) | **FP** (filled, ink-outlined, glossy) | crop-icon-button |
| Sizes | 16–40 px | 15–48 px | **FP** | – |
| Emoji | none | yes | **OWN** (no emoji is Tumbledown's) | phone-shop CT |

### Layout

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Spacing scale | 4, 6, 8, 10, 12, 14, 16, 18, 20 | 2, 4, 6, 8, 10, 12, 18 | **GC** | tokens.json `layout` |
| Gutter | 16 px phone | 8–10 px phone | – | screens |
| Panel sizing | centered, max 380 px, 18 px backdrop padding | full-width bottom sheet, 828 of 844 px tall | **OWN** | screen-menu-shop |
| Desktop | same phone column, scaled ×1.35 | full desktop layout around the 3D town | **OWN** (each differs) | screen-desktop-* |

### Background and world

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| World | sky tower: altitude bands, round sun with rays, puffy clouds, voxel board in a gold frame | 3D isometric town | **OWN** | screen-home |
| Win sunburst | spinning rays behind the ribbon | splash sun with conic rays | **GC** | phone-win |
| Frame | gold well frame, 8 px, radius 20, navy "LEVEL N" plaque | – | **OWN** | phone-play |

### Motion

| Item | Tumbledown | Cartopia | Verdict | Evidence |
|---|---|---|---|---|
| Overshoot curve | `cubic-bezier(.34,1.56,.64,1)` on pops, stamps, ribbons, cards | `cubic-bezier(.3,1.6,.5,1)` on panel titles | **FP**: nearly the same curve | tokens.json `motion` |
| Press | 120 ms ease-out | 100–120 ms | **FP** | – |
| Panel enter | pop from 82% scale, 340 ms | slide up, 300 ms; backdrop fade 200 ms | – (different) | – |
| Idle loops | node pulse 1.6 s, low-pieces heartbeat 1.4 s, rays spin 24 s | collect pulse 1.6 s, bob 0.9 s, glow 2.4 s | **FP** (1.6 s pulse in both) | aggregate `anim` |
| Game feel | hit-stop, shake, steam fizz, goal orbs, confetti | (game-specific) | **OWN** | JUICE.md |
| Reduced motion | `prefers-reduced-motion` plus the in-game toggle | `prefers-reduced-motion` on the splash | **GC** | – |

### Sound

| Item | Tumbledown | Cartopia | Verdict |
|---|---|---|---|
| UI sound | procedural WebAudio: marimba and glockenspiel taps, sparkle rewards, generative music (`src/sound.js`) | music track (`src/audio/rave-halcyon.mp3`) and game sounds | **OWN** (Tumbledown's synthesized palette) |

## Answers

**1. Could someone tell the games apart from a crop?** Mostly no. These crops are effectively indistinguishable:
- [Close button](pairs/crop-close-button.jpg): identical anatomy, size, radius and red.
- [Counter pill](pairs/crop-counter-pill.jpg): coin disc, navy pill, Lilita number.
- [Panel header](pairs/crop-panel-header.jpg): white outlined Lilita title plus a red X on a blue field.
- [Green price / primary button](pairs/crop-primary-button.jpg).
- [List card](pairs/crop-list-card.jpg) with a green price on the right.
- [Ribbon tag](pairs/crop-ribbon-tag.jpg).
- Any single line of white outlined Lilita text.

Only the board and the world (voxel blocks, the gold well, the tower map) and the HUD layout identify Tumbledown.

**2. The ten most recognisable fingerprint traits**, ranked by visual weight × the number of screens it appears on. Every one appears on all Tumbledown screens unless noted.

| # | Trait | Crop pair |
|---|---|---|
| 1 | **Lilita One** as the voice of every label, number and title, at 11–46 px | [crop-panel-header](pairs/crop-panel-header.jpg) |
| 2 | **White display text with a thick dark-navy outline and a hard drop** | [crop-go-button-hud](pairs/crop-go-button-hud.jpg) |
| 3 | **A dark-navy outline (2–3 px) on every shape** | [crop-icon-button](pairs/crop-icon-button.jpg) |
| 4 | **The raised button:** gradient face, light inset line on top, dark inset lip at the bottom, hard drop, press moves down | [crop-primary-button](pairs/crop-primary-button.jpg) |
| 5 | **Navy gradient chrome** (`#33509f → #23377f` vs `#34507f → #1f3358`) for panels, pills and HUD | [crop-hud-top](pairs/crop-hud-top.jpg) |
| 6 | **Candy role colors:** green go `#8ff060`, red `#ff6b5a`, gold `#ffd85c`, sky blue | [crop-primary-button](pairs/crop-primary-button.jpg) |
| 7 | **Red-gradient X close button, 40–44 px, radius 12, top-right** (every sheet) | [crop-close-button](pairs/crop-close-button.jpg) |
| 8 | **Navy coin pill:** gold coin disc left, Lilita number (map, shop) | [crop-counter-pill](pairs/crop-counter-pill.jpg) |
| 9 | **Light list card with a pale-blue lip, thumbnail left, green price chip right, ribbon tag straddling the top** (shop, gifts, codex) | [crop-list-card](pairs/crop-list-card.jpg), [crop-ribbon-tag](pairs/crop-ribbon-tag.jpg) |
| 10 | **Radii locked to the 12–22 px band**, plus the overshoot pop-in curve (`.34,1.56,.64,1` vs `.3,1.6,.5,1`) | [screen-modal](pairs/screen-modal.jpg) |

**3. Structural vs local.**
- **Structural** (in every component; replacing these changes everything): 1 font, 2 text outline, 3 ink outline, 4 button construction, 5 navy chrome, 6 role colors and 10 radius band and curve.
- **Local** (one component each; swappable on their own): 7 close button, 8 coin pill and 9 list card / ribbon tag.

**4. Where Tumbledown already breaks from the default** (keep and grow these):
- The game render: voxel blocks with pixel faces, steam, smoke and dust fizz, and the gold well frame with its plaque.
- The world: the sky tower, with altitude bands, round sun and puffy clouds.
- The map: the tower of floors, the node path, and the pulsing gold and blue nodes.
- The HUD layout: a hero goal meter, a gold pieces badge, and a bottom bar of next, quest and power.
- The charging ring on the power button.
- The aqua striped goal bar.
- No emoji anywhere.
- Centered card sheets rather than full-width bottom sheets.
- The synthesized sound palette.

**5. Docs that claim originality for the default.** Yes:
- `docs/redesign/SIMILARITY.md` compares only against the prototype. Fonts ("Lilita One … Nunito"), palette ("Sky blue, navy chrome, gold rewards, green go, ink outlines") and buttons ("3D press buttons (face, lip, outline)") are all marked **"No"** (not similar). Against Cartopia, every one of those rows would be "Yes".
- `docs/redesign/DIRECTIONS.md` presents Toybox's type and UI chrome (Lilita One plus Nunito, 3D press buttons, navy panels, gold badges) as a designed direction. It is the assistant's house style.
- `DECISIONS.md` calls it "Royal Match-style press UI". That's half true: the construction is genre-standard, but these exact values are the assistant's default and are shared with Cartopia.

## Replacement briefs

One line each: what it is now, why it reads as default, and what kind of direction would break it. No new values; picking them is the next session's job.

| # | Trait | Now | Why it reads as default | Direction that breaks it |
|---|---|---|---|---|
| 1 | Display font | Lilita One everywhere | The assistant's go-to "chunky casual" face; both games use it | A display face with its own character that fits a crumbling sky tower, plus a less ubiquitous partner for small UI text |
| 2 | Text outline | white fill, thick navy outline, hard drop | The same treatment on every label in both games | Fewer outlined words: reserve heavy treatment for one or two hero moments, and give the rest a different emphasis (color, weight, engraving, inset) |
| 3 | Ink outline | 2–3 px navy on every shape | A uniform "sticker" outline is the most visible shared trait | Outline only where it's meaningful (blocks, the board), or an outline color drawn from the world, varied by surface |
| 4 | Button construction | gradient face, inset light line, inset lip, hard drop | Cartopia's buttons are built identically | A different depth language: material-based (stone, brick, wood, glass to match the blocks), a different light direction, or a signature shape |
| 5 | Navy chrome | `#33509f → #23377f` panels and pills | Same navy family as Cartopia | Chrome that belongs to the tower world: masonry, stone, timber, dusk sky, with its own value structure |
| 6 | Role colors | candy green, red, gold, sky blue | The same four as Cartopia, near-identical stops | A narrower palette keyed to the materials (fire, water, ice, stone) for actions and rewards |
| 7 | Close button | red gradient square with an X, top-right | Pixel-for-pixel the same as Cartopia | A different dismiss pattern (tap outside, swipe down, an in-world element) or a differently shaped and colored close |
| 8 | Coin pill | navy pill, gold coin disc, number | The same component in both games | A currency display shaped like something in the world, in a different container |
| 9 | List card / ribbon tag | light card, pale lip, green price right, tag on top | Same card anatomy and price chip as the Cartopia shop | A shop and list layout with a different structure: shelves, tiles, tower floors |
| 10 | Radius band and curve | 12–22 px radii, `.34,1.56,.64,1` overshoot | Both games sit in the same radius band and the same springy curve | A deliberate shape system (sharper or chamfered to suit stone and pixel, or one signature radius) and a motion curve with its own personality |

Genre conventions worth keeping regardless: a clearly dominant primary action, three-star results, a progress ring, short exclamation copy and a red notification dot. The players of this genre expect these. Change how they look, not that they exist.

## Files

- `tumbledown/`: 24 screenshots (12 screens × phone and desktop).
- `cartopia/`: 24 screenshots (12 screens × phone and desktop; the phone race-daily and desktop race-hub captures failed to load).
- `pairs/`: 11 component crop pairs and 8 screen pairs.
- `tokens.json`: every measured Tumbledown value by role, with Cartopia's equivalent where one exists.
