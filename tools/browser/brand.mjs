// Renders the brand assets from docs/redesign/brand.html: the 1024 app icon and the wordmark.
//   node tools/browser/brand.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, ROOT } from './lib.mjs';

const { srv, url } = await serve();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
const page = await ctx.newPage();
await page.goto(`${url}docs/redesign/brand.html`);
await page.waitForFunction(() => window.ready);
for (const [id, files] of [['icon', ['assets/icon-1024.png', 'docs/redesign/store/icon-1024.png']], ['logo', ['assets/wordmark.png']]]) {
  const data = await page.evaluate((i) => document.getElementById(i).toDataURL('image/png'), id);
  const buf = Buffer.from(data.split(',')[1], 'base64');
  for (const f of files) fs.writeFileSync(path.join(ROOT, f), buf);
  console.log(id, buf.length);
}
await browser.close();
srv.close();
