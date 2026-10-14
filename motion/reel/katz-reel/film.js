// Katz Coffee Education: pure function of time. window.seek(t) paints frame t (see lib/motion.js).
// Timing is in beats (u) on the measured 128 bpm grid; docs/shotlist.md is the approved plan.
import * as M from './lib/motion.js';

const { W, H, TAU, E, prog, lerp, clamp, bump, springU, springKeys, SPRING, wobble, shake, mix, font, layout, glyph, text, fill, cover, rrect } = M;

// Brand: Katz green + cream + black (from the manual). One accent (green); red only inside the cherry illustration.
const C = { ink: '#100F0D', paper: '#FBF9EF', green: '#67BB2A', gd: '#3F8A12', sand: '#F0E6B8', red: '#D6262B', white: '#FFFFFF', line: '#E5EED9' };
const DISPLAY = 'Display', UI = 'UI';
const B = [8, 16, 24, 32, 44, 56, 64, 88, 100, 108, 120];   // shot boundaries (beats)

// Every accent: [beat, label, sfx, opts]. sfx.mjs voices each one so sound can't drift from picture.
const HITS = [
  [0, 'badge lands', 'impact'],
  ...B.map((b) => [b, 'wipe', 'whoosh', { len: 0.9 }]),
  [12, 'cherry splits', 'thud'],
  [112, 'wheel settles', 'bell', { pitch: 'C6' }],
  [120.5, 'end badge', 'thud'], [121.4, 'tagline', 'bell', { pitch: 'C6' }],
];

// ------------------------------------------------------------------ helpers
const T = (ctx, str, x, y, size, color, o = {}) =>
  text(ctx, str, x, y, font(size, o.weight || 500, o.fam || UI), color, o.align || 'left', (o.track || 0) * size);

// Glyphs rise out of an invisible baseline mask, each a touch later.
function rise(ctx, str, x, base, size, color, u, u0, o = {}) {
  const f = font(size, 800, DISPLAY), tr = (o.track ?? -0.005) * size;
  const L = layout(ctx, str, f, tr);
  const x0 = o.align === 'center' ? x - L.width / 2 : x;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 60, base - size * 1.02, L.width + 120, size * 1.3); ctx.clip();
  L.glyphs.forEach((g, j) => {
    const k = springU(u, u0 + j * (o.st ?? 0.05), o.cfg || SPRING.snappy);
    if (k > 0) glyph(ctx, g.ch, x0 + g.cx, base + (1 - k) * size * 1.15, f, color);
  });
  ctx.restore();
  return L;
}
function popAt(ctx, cx, cy, k, fn, rot = 0) {
  if (k <= 0.001) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-cx, -cy); fn(); ctx.restore();
}
function box(ctx, x, y, w, h, r, color, shadow = true) {
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(16,15,13,0.20)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14; }
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function stat(ctx, x, y, w, h, big, small, u, u0, o = {}) {
  const k = springU(u, u0, SPRING.bouncy);
  popAt(ctx, x + w / 2, y + h / 2, k, () => {
    box(ctx, x, y, w, h, 28, o.dark ? 'rgba(16,15,13,0.82)' : C.white);
    T(ctx, big, x + 30, y + h * 0.58, h * 0.52, C.green, { fam: DISPLAY, weight: 800 });
    T(ctx, small, x + 30, y + h * 0.58 + h * 0.28, Math.min(31, Math.max(27, h * 0.17)), o.dark ? C.white : C.ink, { weight: 500 });
  });
}
function paperBg(ctx, u) {
  fill(ctx, C.paper);
  ctx.fillStyle = 'rgba(103,187,42,0.09)';
  ctx.beginPath(); ctx.arc(-40 + u * 1.2, -60 + u * 0.8, 380, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(W + 80 - u * 1.4, H + 120 - u * 0.9, 460, 0, TAU); ctx.fill();
}
function photoCard(ctx, img, x, y, w, h, u, u0, u1, o = {}) {
  const k = springU(u, u0, SPRING.gentle);
  if (k <= 0.001) return;
  ctx.save(); ctx.translate((1 - k) * 160, 0); ctx.globalAlpha = Math.min(1, k * 2);
  box(ctx, x, y, w, h, 40, '#ddd');
  cover(ctx, img, x, y, w, h, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, zoom: lerp(1.0, o.zoom ?? 1.12, prog(u, u0, u1)), radius: 40 });
  ctx.restore();
}
function leftShade(ctx, w = 1100, a = 0.78) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, `rgba(16,15,13,${a})`); g.addColorStop(1, 'rgba(16,15,13,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, H);
}

// ------------------------------------------------------------------ S1 hook (u 0..8)
function sceneHook(ctx, u, IMG) {
  fill(ctx, C.ink);
  ctx.save(); shake(ctx, u, 0, 16);
  const k = springU(u, -0.3, SPRING.bouncy);
  const w = 760, h = w * 0.6;
  ctx.save(); ctx.translate(W / 2, 330); ctx.rotate((1 - k) * -0.07); ctx.scale(lerp(1.55, 1, k), lerp(1.55, 1, k)); ctx.globalAlpha = Math.min(1, k * 4);
  ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
  rise(ctx, 'COFFEE EDUCATION', W / 2, 850, 180, C.green, u, 1.6, { align: 'center', st: 0.04 });
  const t = springU(u, 3, SPRING.gentle);
  if (t > 0) { ctx.globalAlpha = Math.min(1, t); T(ctx, 'KATZ TEAM TRAINING MANUAL', W / 2, 925 + (1 - t) * 24, 34, C.sand, { align: 'center', track: 0.28, weight: 500 }); ctx.globalAlpha = 1; }
  const ln = E.outQuint(prog(u, 4, 6));
  ctx.fillStyle = C.green; rrect(ctx, W / 2 - 320 * ln, 965, 640 * ln, 8, 4); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ S2 what is coffee (u 8..16)
function cherry(ctx, cx, cy, r, split) {
  const bean = (dx) => {
    ctx.save(); ctx.translate(cx + dx, cy + r * 0.12);
    ctx.fillStyle = C.sand; ctx.strokeStyle = '#8C6A2F'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.27, r * 0.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.36); ctx.bezierCurveTo(r * 0.12, -r * 0.12, -r * 0.12, r * 0.12, 0, r * 0.36); ctx.stroke();
    ctx.restore();
  };
  ctx.save(); ctx.globalAlpha = clamp(split * 3); bean(-r * 0.31); bean(r * 0.31); ctx.restore();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * split * r * 0.72, 0);
    ctx.beginPath(); ctx.rect(side < 0 ? cx - r * 3 : cx, cy - r * 3, r * 3, r * 6); ctx.clip();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    if (split > 0.02) { ctx.fillStyle = '#F4B3B3'; ctx.fillRect(side < 0 ? cx - 14 : cx, cy - r, 14, r * 2); }
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.4, r * 0.22, r * 0.11, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = C.gd; ctx.beginPath(); ctx.moveTo(cx, cy - r + 6); ctx.bezierCurveTo(cx, cy - r - 70, cx + 70, cy - r - 120, cx + 190, cy - r - 140); ctx.bezierCurveTo(cx + 160, cy - r - 60, cx + 90, cy - r - 10, cx, cy - r + 6); ctx.fill();
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.moveTo(cx, cy - r + 6); ctx.bezierCurveTo(cx, cy - r - 70, cx - 70, cx * 0 + cy - r - 120, cx - 190, cy - r - 140); ctx.bezierCurveTo(cx - 160, cy - r - 60, cx - 90, cy - r - 10, cx, cy - r + 6); ctx.fill();
    ctx.restore();
  }
}
function sceneWhat(ctx, u) {
  paperBg(ctx, u);
  rise(ctx, 'WHAT IS', 100, 250, 150, C.green, u, 8.7); rise(ctx, 'COFFEE?', 100, 395, 150, C.green, u, 9.0);
  const S = [['120+', 'Coffea species', 10], ['SEED', 'of the coffee fruit', 11], ['11th c.', 'first hot drink', 12], ['70+', 'countries grow it', 13]];
  S.forEach(([a, b, u0], i) => stat(ctx, 100 + (i % 2) * 470, 470 + Math.floor(i / 2) * 215, 440, 190, a, b, u, u0));
  const k = springU(u, 8.7, SPRING.bouncy), split = E.outBack(prog(u, 12, 13.4), 1.2);
  popAt(ctx, 1450, 520, k, () => {
    ctx.save(); shake(ctx, u, 12, 8); cherry(ctx, 1450, 520, 190, split); ctx.restore();
  });
  const c = springU(u, 14, SPRING.gentle);
  if (c > 0) { ctx.globalAlpha = Math.min(1, c); T(ctx, 'Born in Ethiopia, on the shores of the Red Sea', 1450, 900 + (1 - c) * 20, 32, C.gd, { align: 'center', weight: 600 }); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------------ S3 growing (u 16..24)
function sceneGrow(ctx, u, IMG) {
  fill(ctx, C.ink);
  cover(ctx, IMG.farm, 0, 0, W, H, { fx: 0.5, fy: 0.62, zoom: lerp(1.0, 1.14, prog(u, 16, 24)) });
  leftShade(ctx, 1200, 0.82);
  rise(ctx, 'GROWING', 100, 220, 170, C.white, u, 16.7); rise(ctx, 'CONDITIONS', 100, 380, 170, C.green, u, 17.0);
  [['1,000 mi', 'max distance from the equator', 18], ['0–7,000 ft', 'altitude, sea level and up', 20], ['3–4 yrs', 'before a tree makes coffee', 22]]
    .forEach(([a, b, u0], i) => stat(ctx, 100, 480 + i * 170, 760, 148, a, b, u, u0, { dark: true }));
}

// ------------------------------------------------------------------ S4 harvesting (u 24..32)
function sceneHarvest(ctx, u, IMG) {
  paperBg(ctx, u);
  rise(ctx, 'HARVESTING', 100, 235, 160, C.green, u, 24.7); rise(ctx, 'COFFEE', 100, 385, 160, C.green, u, 25.0);
  [['1–4', 'hand pickings per harvest', 26], ['2 beans', 'inside every cherry', 28], ['100–200 lb', 'cherries per picker, every day', 30]]
    .forEach(([a, b, u0], i) => stat(ctx, 100, 470 + i * 165, 840, 142, a, b, u, u0));
  photoCard(ctx, IMG.pick, 1010, 80, 810, 900, u, 24.7, 32, { zoom: 1.12, fx: 0.62 });
}

// ------------------------------------------------------------------ S5 processing (u 32..44)
function sceneProcess(ctx, u, IMG) {
  fill(ctx, C.ink);
  cover(ctx, IMG.drying, 0, 0, W, H, { fx: lerp(0.08, 0.92, E.inOutSine(prog(u, 32, 44))), fy: 0.5, zoom: 1.25 });
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(16,15,13,0.72)'); g.addColorStop(0.45, 'rgba(16,15,13,0.05)'); g.addColorStop(1, 'rgba(16,15,13,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  rise(ctx, 'PROCESSING & MILLING', 100, 205, 140, C.white, u, 32.7);
  [['Washed', 'Pulp removed first, fermented, then dried to 10–12% moisture.', 33], ['Semi-washed', 'Seeds machine-pulped, stored, then hulled at the mill.', 36],
   ['Natural', 'The whole cherry dries in the sun, raked and turned.', 39], ['Honey', 'Skin removed. The fruit layer dries on the bean.', 42]].forEach(([a, b, u0], i) => {
    const x = 100 + i * 440, y = 610, k = springU(u, u0, SPRING.bouncy);
    popAt(ctx, x + 205, y + 150, k, () => {
      box(ctx, x, y, 410, 300, 30, C.white);
      T(ctx, a.toUpperCase(), x + 28, y + 80, 62, C.green, { fam: DISPLAY, weight: 800 });
      const words = b.split(' '); let line = '', ly = y + 135;
      words.forEach((wd) => { const test = line + wd + ' '; ctx.font = font(27, 500, UI); if (ctx.measureText(test).width > 350 && line) { T(ctx, line, x + 28, ly, 27, C.ink); ly += 38; line = wd + ' '; } else line = test; });
      T(ctx, line, x + 28, ly, 27, C.ink);
    });
  });
}

// ------------------------------------------------------------------ S6 sorting (u 44..56)
function sceneSort(ctx, u, IMG) {
  paperBg(ctx, u);
  rise(ctx, 'SORTING & GRADING', 100, 215, 150, C.green, u, 44.7);
  const items = [['handsort', 'Hand sorting', 'Most labor intensive. Defects picked out one by one.'], ['mech', 'Mechanical', 'Machines shake beans through sieves by size.'],
    ['densi', 'Densimetric', 'Air + vibration separate heavy beans from light.'], ['color', 'High tech', 'Sensors read each bean’s color and reject defects.']];
  const u0s = [45, 47, 49, 51], w = 400, h = 520, y = 290, imgH = 300;
  items.forEach(([im, a, b], i) => {
    const gap = (1720 - 4 * w) / 3, x = 100 + i * (w + gap), k = springU(u, u0s[i], SPRING.bouncy);
    if (k <= 0.001) return;
    ctx.save(); ctx.translate(0, (1 - Math.min(k, 1.0)) * 140); ctx.globalAlpha = Math.min(1, k * 2.5);
    box(ctx, x, y, w, h, 32, C.white);
    ctx.save(); rrect(ctx, x, y, w, h, 32); ctx.clip();
    cover(ctx, IMG[im], x, y, w, imgH, { zoom: lerp(1.0, 1.12, prog(u, u0s[i], u0s[i] + 5)) });
    ctx.restore();
    T(ctx, a.toUpperCase(), x + 26, y + imgH + 70, 56, C.green, { fam: DISPLAY, weight: 800 });
    let line = '', ly = y + imgH + 118;
    b.split(' ').forEach((wd) => { const t = line + wd + ' '; ctx.font = font(26, 500, UI); if (ctx.measureText(t).width > w - 52 && line) { T(ctx, line, x + 26, ly, 26, C.ink); ly += 36; line = wd + ' '; } else line = t; });
    T(ctx, line, x + 26, ly, 26, C.ink);
    ctx.restore();
  });
  const ln = E.inOutCubic(prog(u, 51, 54));
  ctx.fillStyle = C.green; rrect(ctx, 100, 860, 1720 * ln, 8, 4); ctx.fill();
  if (ln > 0.02) { ctx.beginPath(); ctx.moveTo(100 + 1720 * ln, 836); ctx.lineTo(100 + 1720 * ln + 42, 864); ctx.lineTo(100 + 1720 * ln, 892); ctx.closePath(); ctx.fill(); }
  const tl = springU(u, 53, SPRING.gentle);
  if (tl > 0) { ctx.globalAlpha = Math.min(1, tl); T(ctx, 'LESS LABOR INTENSIVE', 1820, 935 + (1 - tl) * 16, 32, C.gd, { align: 'right', track: 0.14, weight: 600 }); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------------ S7 grade & roast (u 56..64)
function sceneGradeRoast(ctx, u, IMG) {
  paperBg(ctx, u);
  rise(ctx, 'GREEN TO ROASTED', 100, 215, 150, C.green, u, 56.7);
  const items = [['grading', 'Grading', 'Green beans are separated into quality grades, often by size.'], ['roasting', 'Roasting', 'Around 400°F beans brown (Maillard), then release their oils.'], ['fluidbed', 'Roasters', 'Drum or fluid bed, then rapid cooling to room temperature.']];
  const u0s = [57, 59, 61];
  items.forEach(([im, a, b], i) => {
    const x = 100 + i * 600, y = 290, w = 540, h = 640, k = springU(u, u0s[i], SPRING.snappy);
    if (k <= 0.001) return;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(Math.max(0.001, Math.min(k, 1.04)), 1); ctx.translate(-(x + w / 2), -(y + h / 2));
    box(ctx, x, y, w, h, 34, C.white);
    ctx.save(); rrect(ctx, x, y, w, h, 34); ctx.clip();
    cover(ctx, IMG[im], x, y, w, 340, { zoom: lerp(1.0, 1.14, prog(u, u0s[i], 64)) });
    ctx.restore();
    T(ctx, a.toUpperCase(), x + 32, y + 340 + 82, 72, C.green, { fam: DISPLAY, weight: 800 });
    let line = '', ly = y + 340 + 138;
    b.split(' ').forEach((wd) => { const t = line + wd + ' '; ctx.font = font(28, 500, UI); if (ctx.measureText(t).width > w - 64 && line) { T(ctx, line, x + 32, ly, 28, C.ink); ly += 40; line = wd + ' '; } else line = t; });
    T(ctx, line, x + 32, ly, 28, C.ink);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ S8 roast profiles (u 64..88)
function sceneRoast(ctx, u, IMG) {
  paperBg(ctx, u);
  rise(ctx, 'ROAST PROFILES', 100, 215, 140, C.green, u, 64.7);
  const N = [['Cinnamon / American', '400–410°F'], ['Light', '411–420°F'], ['Medium light', '421–431°F'], ['Medium', '432–445°F'], ['Medium dark', '446–456°F'], ['Velvet', '456–459°F'], ['Dark', '466°F +'], ['Double dark', '480–500°F']];
  N.forEach(([name, temp], i) => {
    const x = 100 + (i % 4) * 440, y = 270 + Math.floor(i / 4) * 280, w = 400, h = 258;
    const at = 65 + i * 2.9, hb = bump(u, at + 1.0, 1.6), k = springU(u, 64.8 + i * 0.12, SPRING.bouncy);
    popAt(ctx, x + w / 2, y + h / 2, k * (1 + 0.07 * hb), () => {
      if (hb > 0.01) { ctx.save(); ctx.globalAlpha = hb; box(ctx, x, y, w, h, 28, C.white); ctx.restore(); }
      ctx.drawImage(IMG[`bean${i + 1}`], x + w / 2 - 95, y + 14, 190, 170);
      T(ctx, name.toUpperCase(), x + w / 2, y + 222, 40, mix(C.ink, C.green, hb), { align: 'center', fam: DISPLAY, weight: 800 });
      T(ctx, temp, x + w / 2, y + 250, 24, '#6b6a63', { align: 'center' });
    });
  });
  const p = prog(u, 64.8, 87), bx = 100, by = 880, bw = 1720;
  ctx.fillStyle = '#E8E4D2'; rrect(ctx, bx, by, bw, 22, 11); ctx.fill();
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#d9c08a'); g.addColorStop(0.45, '#b9762f'); g.addColorStop(0.75, '#6b3a1a'); g.addColorStop(1, '#2a140a');
  ctx.save(); rrect(ctx, bx, by, bw, 22, 11); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(bx, by, bw * p, 22); ctx.restore();
  T(ctx, '400°F', bx, by + 66, 28, '#6b6a63', { weight: 600 }); T(ctx, '500°F', bx + bw, by + 66, 28, '#6b6a63', { align: 'right', weight: 600 });
  T(ctx, `${Math.round(400 + 100 * p)}°F`, W / 2, by + 78, 78, C.gd, { align: 'center', fam: DISPLAY, weight: 800 });
}

// ------------------------------------------------------------------ S9 roast facts (u 88..100)
function sceneFacts(ctx, u) {
  paperBg(ctx, u);
  rise(ctx, 'ROASTED COFFEE FACTS', 100, 215, 140, C.green, u, 88.7);
  [['Lighter', 'More acidity. Light-roasted beans stay dry.', 89], ['Darker', 'Less origin flavor, more roasty. Oils show on the bean.', 92],
   ['Caffeine', 'Decreases as the roast gets darker.', 95], ['Espresso', 'NOT a roast. It’s a method of extraction.', 98]].forEach(([a, b, u0], i) => {
    const x = 100 + i * 437, y = 340, w = 410, h = 440, dark = i === 3, k = springU(u, u0, SPRING.snappy);
    if (k <= 0.001) return;
    ctx.save(); shake(ctx, u, u0, i === 3 ? 12 : 6, 5 + i);
    ctx.translate(0, (1 - Math.min(k, 1.0)) * 420); ctx.translate(x + w / 2, y + h / 2); ctx.rotate((1 - Math.min(k, 1.0)) * -0.07); ctx.translate(-(x + w / 2), -(y + h / 2));
    box(ctx, x, y, w, h, 34, dark ? C.ink : C.white);
    T(ctx, a.toUpperCase(), x + 34, y + 115, 84, dark ? C.sand : C.green, { fam: DISPLAY, weight: 800 });
    let line = '', ly = y + 195;
    b.split(' ').forEach((wd) => { const t = line + wd + ' '; ctx.font = font(34, 500, UI); if (ctx.measureText(t).width > w - 68 && line) { T(ctx, line, x + 34, ly, 34, dark ? C.white : C.ink); ly += 50; line = wd + ' '; } else line = t; });
    T(ctx, line, x + 34, ly, 34, dark ? C.white : C.ink);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ S10 cupping (u 100..108)
function sceneCup(ctx, u, IMG) {
  fill(ctx, C.ink);
  cover(ctx, IMG.cupping, 0, 0, W, H, { fx: 0.55, fy: 0.45, zoom: lerp(1.0, 1.16, prog(u, 100, 108)) });
  leftShade(ctx, 1200, 0.85);
  rise(ctx, 'TASTING &', 100, 220, 160, C.white, u, 100.7); rise(ctx, 'CUPPING', 100, 372, 160, C.green, u, 101.0);
  [['1  SMELL', 'Breathe in the brewed coffee deeply', 101.5], ['2  SLURP', 'Spoon it in to spread across the tongue', 103], ['3  SCORE', 'Body · sweetness · acidity · flavor · aftertaste', 104.5]].forEach(([a, b, u0], i) => {
    const x = 100, y = 480 + i * 150, w = 900, h = 124, k = springU(u, u0, SPRING.bouncy);
    popAt(ctx, x + w / 2, y + h / 2, k, () => {
      box(ctx, x, y, w, h, 28, 'rgba(16,15,13,0.82)');
      T(ctx, a, x + 30, y + 76, 58, C.green, { fam: DISPLAY, weight: 800 });
      T(ctx, b, x + 290, y + 74, 27, C.white);
    });
  });
}

// ------------------------------------------------------------------ S11 flavor wheel (u 108..120)
function sceneWheel(ctx, u, IMG) {
  paperBg(ctx, u);
  rise(ctx, 'THE FLAVOR', 100, 250, 150, C.green, u, 108.7); rise(ctx, 'WHEEL', 100, 395, 150, C.green, u, 109.0);
  const k = springU(u, 112, SPRING.gentle);
  if (k > 0) {
    ctx.globalAlpha = Math.min(1, k);
    T(ctx, 'A tool for the coffee taster: built to analyze', 100, 520 + (1 - k) * 24, 34, C.ink); T(ctx, 'and describe coffees.', 100, 568 + (1 - k) * 24, 34, C.ink);
    T(ctx, 'A collaborative effort by the Specialty Coffee', 100, 650 + (1 - k) * 24, 28, C.gd, { weight: 600 }); T(ctx, 'Association and World Coffee Research.', 100, 690 + (1 - k) * 24, 28, C.gd, { weight: 600 });
    ctx.globalAlpha = 1;
  }
  const open = E.outQuint(prog(u, 109, 112)), sp = springU(u, 109, SPRING.gentle);
  const cx = 1390, cy = 520, ww = 940, hh = ww * (IMG.wheel.height / IMG.wheel.width);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 700 * open, 0, TAU); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(lerp(-1.5, 0, sp) + 0.002 * (u - 109)); ctx.scale(lerp(0.8, 1, sp), lerp(0.8, 1, sp));
  ctx.drawImage(IMG.wheel, -ww / 2, -hh / 2, ww, hh); ctx.restore();
}

// ------------------------------------------------------------------ S12 end card (u 120..128)
function sceneEnd(ctx, u, IMG) {
  paperBg(ctx, 120);
  const k = springU(u, 120.6, SPRING.bouncy), w = 700, h = 420;
  if (k > 0) { ctx.save(); shake(ctx, u, 120.6, 10); ctx.translate(W / 2, 330); ctx.scale(lerp(0.78, 1, Math.min(k, 1.06)), lerp(0.78, 1, Math.min(k, 1.06))); ctx.globalAlpha = Math.min(1, k * 3); ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore(); }
  rise(ctx, 'FROM SEED TO CUP.', W / 2, 790, 170, C.green, u, 121.4, { align: 'center', st: 0.045 });
  const s = springU(u, 122.4, SPRING.gentle);
  if (s > 0) { ctx.globalAlpha = Math.min(1, s); T(ctx, 'KATZ COFFEE EDUCATION', W / 2, 880 + (1 - s) * 20, 36, C.gd, { align: 'center', track: 0.28, weight: 600 }); ctx.globalAlpha = 1; }
  const ln = E.outQuint(prog(u, 123, 124.5));
  ctx.fillStyle = C.green; rrect(ctx, W / 2 - 300 * ln, 935, 600 * ln, 8, 4); ctx.fill();
}

// ------------------------------------------------------------------ transitions: a colour block carries across the cut
function wipes(ctx, u) {
  B.forEach((b, i) => {
    if (u < b - 0.75 || u > b + 0.75) return;
    const dir = 'rudl'[i % 4], col = i % 2 ? C.ink : C.green;
    const c = E.inOutCubic(prog(u, b - 0.7, b)), x = E.inOutCubic(prog(u, b, b + 0.7));
    let rx = 0, ry = 0;
    if (dir === 'r') rx = u < b ? -W + c * W : x * W;
    if (dir === 'l') rx = u < b ? W - c * W : -x * W;
    if (dir === 'u') ry = u < b ? H - c * H : -x * H;
    if (dir === 'd') ry = u < b ? -H + c * H : x * H;
    ctx.fillStyle = col; ctx.fillRect(rx, ry, W, H);
    ctx.fillStyle = C.sand;
    if (dir === 'r') ctx.fillRect(rx + W - 34, ry, 34, H);
    if (dir === 'l') ctx.fillRect(rx, ry, 34, H);
    if (dir === 'u') ctx.fillRect(rx, ry, W, 34);
    if (dir === 'd') ctx.fillRect(rx, ry + H - 34, W, 34);
  });
}

M.film({
  fonts: [font(100, 800, DISPLAY), font(40, 500, UI)],
  images: {
    logo: 'assets/logo.svg', farm: 'assets/farm.png', pick: 'assets/pick.png', drying: 'assets/drying.png', handsort: 'assets/handsort.png',
    mech: 'assets/mech.png', densi: 'assets/densi.png', color: 'assets/color.png', grading: 'assets/grading.png', roasting: 'assets/roasting.png',
    fluidbed: 'assets/fluidbed.png', cupping: 'assets/cupping.png', wheel: 'assets/wheel.png',
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`bean${n}`, `assets/bean${n}.png`])),
  },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < B[0]) sceneHook(ctx, u, IMG);
    else if (u < B[1]) sceneWhat(ctx, u);
    else if (u < B[2]) sceneGrow(ctx, u, IMG);
    else if (u < B[3]) sceneHarvest(ctx, u, IMG);
    else if (u < B[4]) sceneProcess(ctx, u, IMG);
    else if (u < B[5]) sceneSort(ctx, u, IMG);
    else if (u < B[6]) sceneGradeRoast(ctx, u, IMG);
    else if (u < B[7]) sceneRoast(ctx, u, IMG);
    else if (u < B[8]) sceneFacts(ctx, u);
    else if (u < B[9]) sceneCup(ctx, u, IMG);
    else if (u < B[10]) sceneWheel(ctx, u, IMG);
    else sceneEnd(ctx, u, IMG);
    wipes(ctx, u);
  },
});
