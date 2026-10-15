# Prompt: find every part of Tumbledown's UI that is "default Claude-coded" style

Paste everything below the line into a fresh session that has both repos: `Joudrie/teris` (Tumbledown, live at https://joudrie.github.io/teris/) and `KeganBerg/Cartopia`.

---

You are auditing the UI of a mobile puzzle game, **Tumbledown** (repo `Joudrie/teris`, live at https://joudrie.github.io/teris/). Its owner has another game, **Cartopia** (repo `KeganBerg/Cartopia`), built with the same AI assistant. Side by side, the two look like the same product: same fonts, same chunky outlined buttons, same navy and sky-blue palette, same pill counters. The owner never chose that look. It is the style the assistant produces by default, and it makes both games look machine-made and interchangeable.

**Your job is diagnosis only. Do not change any code, styles or assets.** Produce a complete, measured inventory of Tumbledown's visual language and say, item by item, what is shared with Cartopia (the "default fingerprint") and what is genuinely Tumbledown's own. A later session will use your report to replace the default parts, so it must be exact enough to act on without re-measuring.

A head start (verify each one, don't trust it):
- Both games use **Lilita One** for display type and **Nunito** for body type.
- Both outline everything with a dark navy ink (`#0d1640` in Tumbledown, `#14213d` / `#1b2a4a` in Cartopia), around 2.5–4 px wide.
- Both buttons are raised: a vertical gradient face, an inset light line on top, an inset dark lip at the bottom, and a hard 3–8 px dark drop shadow. The press state moves the face down and shrinks the lip.
- Both use a green gradient for the main "go" action (`#45c41e` vs `#2fae35`/`#8ef05c`), gold/orange for rewards, navy gradient pills for counters, and big rounded panels (20–26 px radius) with a heavy outline and drop.
- Both display headings use white fill, a thick ink stroke (`paint-order: stroke`) and a hard ink drop shadow.

## Step 1: Get both games running and photograph them

- **Tumbledown:** use the live site, or `npm start` in the repo. It's static, with debug hooks at `?debug`, scripted states at `?scene=<id>` (see `src/scenes.js`), and screenshot tooling in `tools/browser/` (`shoot.mjs`, `lib.mjs`). Chromium is at `/opt/pw-browsers`.
- **Cartopia:** it's a Vite + React + TypeScript project. Read its README and `CLAUDE.md` for how to run it (`npm ci && npm run dev`). If it needs backend keys (Supabase, Stripe), run it without them or with the mock paths it provides. Don't fake screens. It has its own screenshot scripts under `scripts/` (`adminshot/`, `arcadeshot/`); reuse them.
- Capture at **390 × 844** (phone) and **1440 × 900** (desktop), at device pixel ratio 2 or 3. Cover every screen and popup you can reach in each game:
  - home/map, gameplay HUD, pause/settings, a sheet or modal, shop, rewards
  - win, lose, a toast, a tutorial callout, and any list or row
- Save under `docs/fingerprint/tumbledown/` and `docs/fingerprint/cartopia/`. Also make side-by-side pairs of comparable screens under `docs/fingerprint/pairs/`: home vs home, primary button vs primary button, modal vs modal, HUD vs HUD, and so on.

## Step 2: Measure, don't eyeball

For each game, read the real values from the code (CSS custom properties, component CSS, inline styles, canvas drawing code) **and** confirm them in the browser with `getComputedStyle` on the live elements. Record exact values: hex, px, weight, ms, cubic-bezier. Where code and render disagree, report the render and note the code.

Cover every category below. For each item give: the value(s), where it lives (file:line or selector), which screens use it, and a cropped screenshot reference.

1. **Typography:**
   - every font family and where each is used, and how it's loaded (self-hosted or Google)
   - every font size in use (list the full scale), weights, line heights, letter spacing, text transform
   - text colors, text stroke width and color, text shadows (offset, blur, color)
   - gradient-filled text
   - number styling: tabular or proportional, separators
   - the copy voice: exclamation marks, title case vs sentence case, typical label length
2. **Color:**
   - the full palette: every distinct color, grouped by role (background, surface, ink/outline, primary action, secondary action, reward, danger, success, text, disabled)
   - every gradient: its stops and direction
   - opacity and overlay values
   - the value structure: lightest to darkest layer
   - how saturated and how many hues
3. **Shape and depth:**
   - border radius of each component (buttons, icon buttons, panels, sheets, pills, chips, cards, badges, bars, tiles)
   - outline widths and colors
   - every box-shadow: inset highlights, bottom lips, hard drops, soft drops, glows
   - the "lip" depth in px
   - how pressed, disabled, focused and selected states change each of these
4. **Components** — for each one: size (height, min width, padding), radius, fill, outline, shadow, text style, icon size and placement, states, and the press animation:
   - primary, secondary and danger buttons
   - icon buttons
   - pills and counters
   - panels, sheets and modals, including the header bar, close button, backdrop color and blur
   - cards and rows
   - toggles
   - progress bars and rings
   - badges and notification dots
   - ribbons and banners
   - toasts
   - tooltips and callouts
   - tabs and segmented controls
   - star ratings
   - map nodes
   - the HUD top bar and the bottom action bar
5. **Icons:** the drawing style (filled or outline, stroke width, ink outline via `paint-order`, drop shadow), the grid size, the color treatment, any emoji or Unicode glyphs, and sizes in use.
6. **Layout:**
   - the spacing scale (every gap and padding value in use)
   - side gutters and safe areas, grid and alignment
   - where the HUD elements sit on phone and desktop
   - how panels size against the screen (width, max-width, margins)
   - z-order of overlays
7. **Backgrounds and world:**
   - page background, gradients, sunbursts and rays, clouds, vignettes
   - how the game board or scene is framed (frame color, width, radius, plaque)
8. **Motion:**
   - every duration and easing curve, entrance animations (pop, overshoot, slide), press feedback
   - idle loops (pulse, bob, shimmer)
   - number count-ups, screen shake, flashes, particle styles
   - reduced-motion handling
9. **Sound and haptics**, briefly: which UI sounds exist and what they sound like, so the audit covers the feel as well as the look.

## Step 3: Compare and classify

Build one master table with a row per item from Step 2 and these columns:

| Item | Tumbledown value | Cartopia value | Verdict | Evidence |

Each verdict is one of these:
- **Default fingerprint:** the same or nearly the same in both games (same font, same hex within about 10% lightness, same radius ±4 px, same shadow construction, same component anatomy). These are the ones to replace.
- **Genre convention:** shared, but also standard in top-grossing casual games (for example, a green primary button exists in Royal Match and Candy Crush too). Flag these; replacing them is optional and may cost readability.
- **Tumbledown's own:** not in Cartopia and specific to this game (for example, the voxel block faces, the tower map, the steam effects).

When in doubt between "fingerprint" and "convention", call it fingerprint and say why.

Then answer these directly:
1. If someone saw only a cropped button, a panel, or a line of text from each game, could they tell the games apart? Which crops are indistinguishable?
2. What are the **ten most recognisable fingerprint traits**, ranked by how much each makes Tumbledown look like Cartopia? Use visual weight × how many screens it appears on.
3. Which traits are structural, appearing in every component (the ink outline, the press lip, the display font)? Which are local, appearing in one component?
4. Where does Tumbledown already break from the default? Those parts are worth keeping and growing.
5. Does anything in Tumbledown's own docs claim a choice was original when it's actually the default? Check `docs/redesign/DESIGN_SYSTEM.md`, `DECISIONS.md` and `SIMILARITY.md`. Note it plainly.

## Step 4: Deliverables

- `docs/fingerprint/REPORT.md` contains:
  - the master table
  - the answers above
  - the top-ten list, with a crop pair for each trait
  - a short "replacement brief" per fingerprint trait: what it is now, why it reads as default, and what kind of direction would break it, in one line. Give no specific new values; picking those is the next session's job.
- The screenshots and pairs in `docs/fingerprint/`.
- A machine-readable `docs/fingerprint/tokens.json` with every measured Tumbledown value (fonts, sizes, colors, radii, shadows, durations) keyed by role, so the replacement session can diff against it.

## Rules

- **Change nothing in either game.** No code, CSS, asset or config edits. You may add files only under `docs/fingerprint/` in the Tumbledown repo, plus throwaway scripts in a scratch folder.
- Cartopia is read-only. Never push to it.
- Every claim needs evidence: a value from code, a computed style, or a screenshot crop. "Looks similar" alone isn't a finding.
- Be exhaustive over brief. A missed shared trait means the replacement leaves a fingerprint behind.
- When done, commit the `docs/fingerprint/` files and publish following Tumbledown's `CLAUDE.md`. The game itself won't change. End your report with the live link, https://joudrie.github.io/teris/.
