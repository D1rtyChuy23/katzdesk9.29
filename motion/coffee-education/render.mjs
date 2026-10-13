// usage: node render.mjs frames out.mp4 | node render.mjs stills 0.5,10,59.9
import { chromium } from 'playwright'; import fs from 'fs'; import { execSync } from 'child_process'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url)), [mode, arg, arg2] = process.argv.slice(2);
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() == 'error' && errs.push(m.text()));
await p.goto('file://' + dir + '/index.html?render'); await p.evaluate(() => document.fonts.ready);
await p.waitForFunction(() => [...document.images].every(i => i.complete));
const out = path.join(dir, 'renders'); fs.mkdirSync(out, { recursive: true });
if (mode == 'stills') { for (const t of arg.split(',')) { await p.evaluate(t => window.seek(+t), t); await p.screenshot({ path: `${out}/still-${t}.png` }); } }
else {
  const fr = path.join(out, 'frames'); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
  for (let i = 0; i < 1800; i++) { await p.evaluate(t => window.seek(t), i / 30); await p.screenshot({ path: `${fr}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 95 }); if (i % 150 == 0) console.log('frame', i); }
  execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${fr}/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow -movflags +faststart ${arg}`, { stdio: 'inherit' });
  fs.rmSync(fr, { recursive: true, force: true });
}
console.log('console/page errors:', errs.length ? errs : 'none'); await b.close();
