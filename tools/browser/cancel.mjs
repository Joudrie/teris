// Frame-by-frame strip of the core moment: a water piece slammed into fire, cancelling.
// Runs on a paused clock, so every frame is exactly `step` ms of game time apart.
//   node tools/browser/cancel.mjs [--proto=<checkout of the prototype>]
// Writes docs/redesign/after/motion-cancel.jpg, and with --proto also
// docs/redesign/compare/motion-cancel.jpg (prototype row above the redesign row).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, serve, ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const proto = (args.find((a) => a.startsWith('--proto=')) || '').slice(8);
const STEP = 80;
const FRAMES = 12;

async function film(root, out) {
  const { srv, url } = await serve(root);
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(`${url}?debug&scene=douse`);
  await page.clock.runFor(500);
  await page.waitForFunction(() => window.mb && mb.sceneReady);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(300);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
  await page.clock.runFor(100);
  const clip = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); return { x: b.x, y: b.y + b.height * 0.6, width: b.width, height: b.height * 0.4 }; });
  fs.mkdirSync(out, { recursive: true });
  await page.keyboard.press(' ');
  await page.clock.runFor(17);
  for (let i = 0; i < FRAMES; i++) {
    await page.screenshot({ path: path.join(out, `f${String(i).padStart(2, '0')}.png`), clip });
    await page.clock.runFor(STEP);
  }
  await browser.close();
  srv.close();
}

const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'cancel-'));
const rows = [];
if (proto) {
  await film(path.resolve(proto), path.join(tmp, 'before'));
  rows.push(['BEFORE', path.join(tmp, 'before')]);
}
await film(ROOT, path.join(tmp, 'after'));
rows.push(['AFTER', path.join(tmp, 'after')]);

const py = `
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
step, out, rows = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
font = None
for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    if os.path.exists(f): font = ImageFont.truetype(f, 22)
strips = []
for k in range(0, len(rows), 2):
    label, d = rows[k], rows[k + 1]
    fs = sorted(glob.glob(d + '/f*.png'))
    ims = [Image.open(f).convert('RGB') for f in fs]
    w, h = ims[0].size
    s = 0.5
    tw, th = int(w * s), int(h * s)
    cols = 6
    nrows = (len(ims) + cols - 1) // cols
    head = 40
    o = Image.new('RGB', (cols * tw + 140, nrows * (th + 30) + head), (16, 16, 20))
    dr = ImageDraw.Draw(o)
    dr.text((12, 8), label, fill=(255, 200, 58) if label == 'AFTER' else (150, 150, 160), font=font)
    for i, im in enumerate(ims):
        x, y = 140 + (i % cols) * tw, head + (i // cols) * (th + 30)
        o.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 26))
        dr.text((x + 6, y + 2), f'{i * step} ms', fill=(220, 220, 220), font=font)
    strips.append(o)
W = max(s.width for s in strips)
H = sum(s.height for s in strips) + 12 * (len(strips) - 1)
o = Image.new('RGB', (W, H), (8, 8, 10))
y = 0
for s in strips:
    o.paste(s, (0, y)); y += s.height + 12
o.save(out, quality=86)
`;
const outs = [path.join(ROOT, 'docs/redesign/after/motion-cancel.jpg')];
if (proto) outs.push(path.join(ROOT, 'docs/redesign/compare/motion-cancel.jpg'));
execFileSync('python3', ['-I', '-c', py, String(STEP), outs[0], 'AFTER', path.join(tmp, 'after')], { stdio: 'inherit' });
if (proto) execFileSync('python3', ['-I', '-c', py, String(STEP), outs[1], ...rows.flat()], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(outs.map((o) => path.relative(ROOT, o)).join('\n'));
