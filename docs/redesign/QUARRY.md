# Design system: Quarry

The interface is built from the game's own blocks. It replaces Toybox, which the [fingerprint audit](../fingerprint/REPORT.md) showed was the assistant's default style, shared with Cartopia. The direction was picked from four [prototypes](replace/).

Tokens live at the top of [`style.css`](../../style.css). The block textures (`--tex-stone`, `--tex-brick`, `--tex-wood`, `--tex-fire`, `--tex-ice`, `--tex-sand`) are baked from the real tiles by `src/main.js` at startup.

## The rules

| | Toybox (old, default) | Quarry |
|---|---|---|
| **Type** | Lilita One everywhere, Nunito body | **Jersey 10** (pixel) for numbers and short words, **Silkscreen** for small caps labels, **Space Grotesk** for anything you read |
| **Text treatment** | White, 8-way navy outline, hard drop | Cream with one solid step underneath. Titles are carved into wood (dark text, light emboss). No outlines |
| **Edges** | 3 px navy outline on every shape | None. Depth is the blocks' one-texel bevel: light top-left, dark bottom-right (`--bevel`) |
| **Corners** | 12–22 px radius | Square, or a 5 px chamfer (`--chamfer`) on buttons and pills |
| **Buttons** | Candy gradient face, inset lip, hard drop | Blocks: **fire** for the main action (with a dark band behind the label), **ice** secondary, **gold** rewards, **brick** danger, **stone** neutral. Pressing sinks the block into its socket (`--bevel-in`) |
| **Panels** | Navy gradient | Stone slabs (`--slab`), deeper stone for the board frame |
| **Close** | Red square with X | Small stone keystone, plus tap outside |
| **Currency** | Navy pill | Dark stone chip |
| **Shop** | Light cards, green price right | Items in stone niches on a wooden shelf; prices hang as paper tags |
| **Stars** | Glossy vector stars | Pixel gold stars that land like blocks, with dust |
| **Motion** | Springy overshoot pop | Things fall and land: gravity in (`--fall`), a squash on impact, dust and a thud. Menus crumble into stone rubble when closed; Play bursts into embers |

## Moments

- **Menus** fall from the top, land with a thud and dust (`app.slabLanded`), and break into rubble when closed (`app.crumble`, `fx.rubble`).
- **Play** bursts into fire embers as the level drops in.
- **Stars** land one by one, each with dust and the star sound.
- **Praise words** on the board use Jersey 10 with a carved brown edge (`drawText` in `fx.js`).
- **Daily gift** is a wooden crate that rattles; claiming breaks it into splinters (`app.breakCrate`, sound `crate`) before the reward flies out.
- **The tower map** remembers the floor you were on. Come back after clearing floors and that floor's keystone crumbles, the view drops down the tower, and the new floor lands with a thud (`buildMap` in `screens.js`).

## Sound

Interface sounds match the materials (`src/sound.js`): `tap` is a stone block clicking into its socket, `open` is rushing air as a slab falls, `slab` is the landing thud with grit, `crumble` is stone breaking up, `ember` is the Play block bursting, and `crate` is wood cracking open.

## Round 2 (owner feedback)

- **Landed blocks merge.** A falling piece shows its cells so its shape reads; once it lands, every block of the same material becomes one continuous shape. The board draws landed particles from seamless body tiles and puts the bevel and edge only around the outside of each material region (`drawMerged` in `board.js`, `paintPixelBody` in `tiles.js`).
- **Legibility.** Texture lives on frames, never behind words: every panel and button is a solid face inside a textured border. Menus blur and darken the page behind them. A contrast audit (WCAG: 4.5:1 for body text, 3:1 for large display text) over ten screens finds no failures.
- **Everything is named.** The next tray names the next piece's material; a "Now" tag on top of it names the falling piece (for example "Ice + Glass").
- **The descent.** The backdrop changes with every floor: stars at the top of the tower, the sun over a sea of clouds, inside the clouds, skyscraper rooftops, the skyline, trees up close, then the ground (`quarry` in `world.js`). The tower map paints the same journey down its whole height (`paintTower`).
- **A living sky.** Clouds drift, stars twinkle, the sun breathes and a bird flaps past every 20–40 seconds (`src/render/sky.js`). It's off at the lowest quality step and while menus are open.
