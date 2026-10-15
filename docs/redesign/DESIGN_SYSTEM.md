# Design system: Toybox (replaced)

> **Replaced by [QUARRY.md](QUARRY.md).** Toybox turned out to be the assistant's default style, shared almost value for value with Cartopia ([fingerprint report](../fingerprint/REPORT.md)). Kept for history.

The tokens live in code: CSS custom properties at the top of [`style.css`](../../style.css), and the board and material palette in [`src/render/skins.js`](../../src/render/skins.js). Components use tokens only. To add a color, add a token.

## Tokens

### Color

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0d1640` | Every outline, every text stroke, icon outlines |
| `--navy` / `--navy-hi` / `--navy-lo` | `#23377f` / `#33509f` / `#182766` | Panels, plaque, secondary chrome |
| `--track` | `#0f1a4a` | Empty bar tracks, inactive toggles |
| `--card` / `--card-lip` | `#f4f8ff` / `#c5d3f0` | Light cards (results, codex, shop items) |
| `--green` (+ `-hi`, `-lip`, `-ink`) | `#45c41e` | Go: Play, Continue, Claim, revive |
| `--blue` (+ `-hi`, `-lip`) | `#2f74e8` | Secondary actions: replay, restart, pause |
| `--gold` (+ `-hi`, `-lo`, `-lip`, `-ink`) | `#ffc83a` | Rewards: coins, stars, pieces badge, the well frame, daily |
| `--red` (+ `-hi`, `-lip`) | `#e2362a` | Celebration ribbon, alerts, the close button, low pieces |
| `--aqua` / `--aqua-hi` | `#27c4ff` / `#8ff0ff` | The goal meter and drain flights |
| `--sky` | `#2f8ef0` | Fallback page color under the world backdrop |

**Value structure.** The well is the darkest, most neutral surface on screen (`#34479a → #1e2a5e`, with faint masonry and light from above), so materials carry all the saturation. UI chrome is a mid-dark navy. Rewards are the only warm, light UI color. The world backdrop is the lightest layer and sits furthest back.

### Materials (`TOYBOX.mats`)

Each material has `base`, `light`, `dark` and `edge` colors, plus a few extras: `glow` for fire, `drop` for wet wood, `mortar` for brick. They differ in **hue, value and pattern**; see [readability](readability/).

| Material | Base | Pattern | Form |
|---|---|---|---|
| Fire | `#ff7b1c` | Magma: dark crust, molten body, pulsing bright cracks | Glowing cube, flame tongues, light on its neighbors |
| Water | `#2f8cff` | Moving ripple lines, depth tint | Smooth liquid body with a bright surface lip |
| Wood | `#c98a4b` | Two planks, grain, nail heads | Cube |
| Wet wood | `#6e5038` | Planks with cyan drips | Darker, browner cube |
| Ice | `#a6e6ff` | Inner rim, crack, frosted corner | Opaque pale cube |
| Sand | `#f3c96d` | Grains | Loose, slumped heap |
| Glass | `#9fe8ff` (alpha) | Sheen band, bright frame | See-through pane |
| Stone | `#9198a6` | Cobbles with mortar | Cube |
| Brick | `#c9533c` | Offset bricks, light mortar | Cube |
| Mud | `#6a4224` | Glossy, bubbles | Loose body |

### Type

| Role | Face | Where |
|---|---|---|
| Display | Lilita One 400 | Every number, label, button and title; canvas praise words |
| UI | Nunito 800 (500–900 variable) | Body copy in cards, sheets, codex |

Game text (`.t` in CSS, `drawText` in `fx.js`): white fill, 2 px ink outline on all sides, and a 4 px drop of ink at 45% alpha. Hero words use a three-stop gradient fill (gold, aqua, pink, green, red) with a white shine on the top third. Both faces are self-hosted `.woff2` under the SIL Open Font License.

### Shape and depth

- **Radii:** `--r-sm 12`, `--r-md 16`, `--r-lg 20`, `--r-xl 26`.
- **Outline:** `--stroke` 3 px ink on everything interactive.
- **Lip depth:** every pressable surface has a darker bottom lip, an inset shadow of 6–8 px.
- **Drops:** `--drop` is 4 px of ink at 35%; `--drop-lg` adds a soft 14/26 shadow for floating cards.

### Motion

| Token | Value | Use |
|---|---|---|
| `--t-fast` | 120 ms | Press and release |
| `--t-med` | 250 ms | Fades, toggles |
| `--t-slow` | 420 ms | Vignette, rising cards |
| `--out-back` | `cubic-bezier(.34,1.56,.64,1)` | Pop-ins, stamps, bumps |
| `--out-expo` | `cubic-bezier(.16,1,.3,1)` | Bars filling, rings, intro card |

Reduced motion: `prefers-reduced-motion` and the in-game **Motion** toggle (`body.calm`) cut every animation to 1 ms. They also turn off screen shake, reduce flashes to 40% and drop most particles. All information stays.

## Components

| Component | Construction | States |
|---|---|---|
| **Press button** `.btn` + `.btn-green/blue/gold/red/navy` | Gradient face, inner top highlight, inset bottom lip (`--lip`), 3 px ink outline, `--drop` | Pressed: face moves down 4 px, lip shrinks to 4 px. Disabled: greyed. Focus: 3 px white ring |
| **Icon button** `.btn-ic` | 52 px rounded square, blue face, 6 px lip | Pressed |
| **Panel** `.panel` | Navy gradient, inner highlight and shadow, outline, drop | – |
| **Goal meter** `.goal` | Gold icon disc and thick bar with an aqua gradient and stripes; number in display type | Bump when a flight lands; the icon gets a hit pop |
| **Pieces badge** `.moves` | Gold rounded square, big number | `.low`: red face plus heartbeat at 3 left; red vignette at 1 |
| **Well** `.well` | Gold frame with lip, ink border around the canvas, level plaque on the top edge | Shake (transform). `.lost`: canvas desaturates |
| **Next tray** `.next` | Navy panel with the next piece in real tiles | Pop when it changes |
| **Quest chip** `.quest` | Icon, short line, progress bar, count | `.done`: green with a check |
| **Power button** `.power` | Conic charge ring in the power's color around a glossy face with the power icon; label tag | `.ready`: white ring, colored glow, pulse, red READY tag. Tap or swipe up to fire |
| **Pill** `.pill` | Translucent ink capsule with an icon and a number | – |
| **Map node** `.node` | Gold disc with number and stars; `.cur` blue with a pulsing ring; `.lock` grey with a lock; `.show` pink for showcase floors | – |
| **Booster chip** `.boost` | Solid navy chip with a lip, icon, label and count badge | `.on`: green; `.empty`: gold "+" badge that opens the shop |
| **Text link** `.btn-link` | Underlined display type, no face; for the quiet way out ("Give up") under a primary offer | Focus: white ring |
| **Ribbon** `.ribbon` | Red (win), blue (lose) or gold (daily) banner in display type | Drop-in |
| **Stars** `.stars` | Three star icons, middle one larger | `.on` stamps in, 320 ms apart, each with a sound |
| **Progress ring** `.ring` | SVG ring, aqua stroke, percentage in the middle | Fills over 900 ms |
| **Card** `.card` | Light card, ink outline, lip; rows with icon, label and value; reward row in gold | Rises in |
| **Sheet** `.sheet` | Panel dialog with a red close button | Pops in |
| **Toggle** `.toggle` | Dark track that turns blue when on, with a switch | On / off |
| **Shop item** `.item` | Light tile with icon or tile preview, name and green price chip; `.ribbon-tag` for "Best value" | Owned / In use |
| **Callout** `.callout` | White card with an animated hand gesture (slam, swipe, tap or swipe up), one short line with the key words in blue, and the material tiles | Fades as it times out |
| **Toast** `.toast` | Green or navy capsule that drops in from the top | – |

## Icons

There's one set, [`src/ui/icons.js`](../../src/ui/icons.js): 40 chunky filled glyphs on a 24-unit grid. They take the text color, and an ink outline comes from `paint-order: stroke`. There are no emoji or Unicode glyphs anywhere.

## Brand

- **Name:** **Tumbledown**. Alternatives are in [DECISIONS.md](DECISIONS.md).
- **Wordmark:** [`assets/wordmark.png`](../../assets/wordmark.png), generated by `tools/browser/brand.mjs` from `docs/redesign/brand.html`. Gold on the first six letters, aqua on the last four, each letter tilted, and the word steps down to the right.
- **App icon:** [`store/icon-1024.png`](store/icon-1024.png): water tumbling onto fire and wood, with steam where they meet. The favicon is [`assets/icon.svg`](../../assets/icon.svg).

The code name `material-blocks` and every `mb_*` save key are unchanged.
