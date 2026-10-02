import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyImage, pickImages, pixelStats } from "../src/lib/ops/spec-image-pick.ts";

// ---- tiny software renderer for 96×96 RGBA test images ----
const N = 96;
function canvas(fill = [255, 255, 255]) {
  const px = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) px.set([...fill, 255], i * 4);
  return px;
}
const set = (px, x, y, c) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  px.set([...c, 255], (y * N + x) * 4);
};
function rect(px, x0, y0, x1, y1, c) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(px, x, y, c);
}
/** Deterministic noise so the tests don't flake. */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Yellow warning triangle, black border and "!" on white — a big flat safety symbol. */
function warningTriangle() {
  const px = canvas();
  for (let y = 8; y < 88; y++) {
    const half = ((y - 8) / 80) * 40;
    for (let x = Math.round(48 - half); x <= Math.round(48 + half); x++) {
      const edge = x - (48 - half) < 4 || 48 + half - x < 4 || y > 82;
      set(px, x, y, edge ? [0, 0, 0] : [255, 204, 0]);
    }
  }
  rect(px, 45, 34, 51, 64, [0, 0, 0]);
  rect(px, 45, 70, 51, 76, [0, 0, 0]);
  return px;
}
/** Same symbol with a glossy gradient (some PDFs embed shaded icons). */
function glossyTriangle() {
  const px = warningTriangle();
  for (let i = 0; i < N * N; i++) {
    const y = Math.floor(i / N);
    if (px[i * 4] === 255 && px[i * 4 + 1] === 204) px.set([255 - y, 210 - y, 10], i * 4);
  }
  return px;
}
/** Red wordmark-style logo: thick red blocks on white. */
function logo() {
  const px = canvas();
  for (let k = 0; k < 4; k++) rect(px, 10 + k * 20, 34, 24 + k * 20, 62, [210, 20, 30]);
  return px;
}
function barcode() {
  const px = canvas();
  const r = rng(7);
  for (let x = 6; x < 90; x++) if (r() > 0.5) rect(px, x, 16, x + 1, 80, [0, 0, 0]);
  return px;
}
/** Front + side line drawing with dimension lines. */
function dimensionDrawing() {
  const px = canvas();
  const box = (x0, y0, x1, y1) => {
    rect(px, x0, y0, x1, y0 + 1, [0, 0, 0]);
    rect(px, x0, y1, x1 + 1, y1 + 1, [0, 0, 0]);
    rect(px, x0, y0, x0 + 1, y1, [0, 0, 0]);
    rect(px, x1, y0, x1 + 1, y1, [0, 0, 0]);
  };
  box(10, 14, 40, 76);
  box(56, 14, 84, 76);
  rect(px, 10, 84, 41, 85, [60, 60, 60]);
  rect(px, 56, 84, 85, 85, [60, 60, 60]);
  rect(px, 4, 14, 5, 77, [60, 60, 60]);
  return px;
}
/** A machine photo: dark body with shading and reflections, stainless panel, on a white backdrop. */
function machinePhoto(seed = 3) {
  const px = canvas([250, 250, 250]);
  const r = rng(seed);
  for (let y = 16; y < 84; y++) {
    for (let x = 26; x < 70; x++) {
      const shade = 0.5 + 0.5 * Math.cos(((x - 26) / 44) * Math.PI);
      const v = Math.round(28 + 150 * shade * (1 - (y - 16) / 140) + (r() - 0.5) * 18);
      set(px, x, y, [v, Math.round(v * 0.98), Math.round(v * 1.04)]);
    }
  }
  rect(px, 32, 22, 64, 34, [22, 24, 30]);
  for (let x = 34; x < 62; x++) set(px, x, 28, [60 + x, 150, 200]);
  for (let y = 60; y < 84; y++) for (let x = 40; x < 56; x++) set(px, x, y, [120 + ((x * 3) % 30), 90 + (y % 20), 60]);
  return px;
}
/** Black machine on white — the hard case: mostly white and black, few mid-tones. */
function darkMachinePhoto() {
  const px = canvas([255, 255, 255]);
  const r = rng(11);
  for (let y = 12; y < 86; y++) {
    for (let x = 30; x < 66; x++) {
      const v = Math.round(12 + 46 * Math.abs(Math.sin((x - 30) / 9)) + (r() - 0.5) * 10 + (y - 12) / 6);
      set(px, x, y, [v, v, v + 2]);
    }
  }
  for (let y = 40; y < 52; y++) for (let x = 34; x < 62; x++) set(px, x, y, [150 + (x % 24) * 3, 152 + (x % 24) * 3, 158 + (x % 24) * 3]);
  return px;
}

const kind = (px, w = 900, h = 800) => classifyImage(w, h, pixelStats(px));

test("a warning triangle is rejected, however large", () => {
  assert.equal(kind(warningTriangle(), 1200, 1100), "icon");
  assert.equal(kind(glossyTriangle(), 1200, 1100), "icon");
  assert.ok(pixelStats(warningTriangle()).warning > 0.18);
});

test("logos, barcodes and small images are rejected", () => {
  assert.equal(kind(logo(), 800, 400), "icon");
  assert.equal(kind(barcode(), 600, 300), "icon");
  assert.equal(kind(machinePhoto(), 120, 140), "icon", "under 150 px on a side");
  assert.equal(kind(machinePhoto(), 2000, 300), "icon", "banner strip");
});

test("a dimension drawing is a diagram, never a photo", () => {
  assert.equal(kind(dimensionDrawing(), 1000, 700), "diagram");
  assert.equal(kind(dimensionDrawing(), 200, 180), "icon", "tiny line art is an icon, not the diagram");
});

test("a machine photo is a photo — including a black machine on white", () => {
  assert.equal(kind(machinePhoto(), 700, 820), "photo");
  assert.equal(kind(darkMachinePhoto(), 600, 760), "photo");
});

const cand = (id, px, w, h, extra = {}) => ({ id, page: 1, width: w, height: h, kind: classifyImage(w, h, pixelStats(px)), pages: 1, ...extra });

test("the machine photo is chosen over a bigger warning symbol; the drawing goes to Dimensions", () => {
  const pick = pickImages([
    cand("warning", warningTriangle(), 1400, 1300),
    cand("logo", logo(), 800, 400, { pages: 3 }),
    cand("barcode", barcode(), 600, 300),
    cand("dims", dimensionDrawing(), 1000, 700),
    cand("machine", machinePhoto(), 520, 640),
  ]);
  assert.equal(pick.primary?.id, "machine");
  assert.equal(pick.diagram?.id, "dims");
  assert.ok(pick.rejected.some((r) => r.id === "warning"));
});

test("nothing photo-like → primary stays empty (never the wrong picture)", () => {
  const pick = pickImages([cand("warning", warningTriangle(), 1400, 1300), cand("dims", dimensionDrawing(), 1000, 700), cand("logo", logo(), 800, 400)]);
  assert.equal(pick.primary, null);
  assert.equal(pick.diagram?.id, "dims");
});

test("an image repeated across pages is rejected even if it looks like a photo", () => {
  const pick = pickImages([cand("footer", machinePhoto(5), 900, 700, { pages: 2 }), cand("machine", machinePhoto(), 520, 640)]);
  assert.equal(pick.primary?.id, "machine");
});

test("two similar photos: the one nearest the model name wins; a clearly larger one still wins", () => {
  const title = { page: 1, x: 80, y: 720 };
  const near = cand("near-title", machinePhoto(), 600, 600, { cx: 150, cy: 600 });
  const far = cand("accessory", machinePhoto(9), 640, 620, { cx: 480, cy: 120 });
  assert.equal(pickImages([far, near], title).primary?.id, "near-title");
  const big = cand("big", machinePhoto(9), 1600, 1500, { cx: 480, cy: 120 });
  assert.equal(pickImages([big, near], title).primary?.id, "big");
  // Page 2 photo vs page 1 photo of similar size: page 1 (with the title) wins.
  const p2 = cand("page2", machinePhoto(4), 640, 640, { page: 2, cx: 150, cy: 600 });
  assert.equal(pickImages([p2, near], title).primary?.id, "near-title");
});
