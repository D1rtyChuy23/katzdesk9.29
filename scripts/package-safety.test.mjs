/**
 * Package safety (11/16 audit). Two kinds of check, both read from the files as they are checked in:
 *
 * 1. Floors: packages that had a published security fix stay at or above the fixed version in package-lock.json,
 *    so a lockfile regenerated from older ranges can't quietly bring the issue back.
 * 2. Held packages: three advisories are still open because the fix is a breaking upgrade (better-auth 1.7 changes
 *    the sign-in callback address the Grok broker knows; pdf.js 6 changes how pictures are read out of a PDF).
 *    Each one only bites when a feature KatzDesk doesn't use is switched on. These tests fail the day someone
 *    switches that feature on while the package is still below its fix, which is the day the upgrade stops being optional.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages;

const parts = (v) => v.split("-")[0].split(".").map((n) => Number(n) || 0);
/** True when version a is at or above b (release numbers only; a pre-release counts as its release). */
const atLeast = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return true;
};
/** Every installed copy of a package (the top-level one and any nested under another package). */
const copies = (name) =>
  Object.entries(lock)
    .filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))
    .map(([path, p]) => ({ path, version: p.version }));

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const src = sources(join(root, "src")).map((file) => ({ file: file.slice(root.length), text: readFileSync(file, "utf8") }));
const using = (pattern) => src.filter((s) => pattern.test(s.text)).map((s) => s.file);

test("atLeast compares release numbers", () => {
  assert.equal(atLeast("4.6.7", "4.6.6"), true);
  assert.equal(atLeast("4.6.6", "4.6.6"), true);
  assert.equal(atLeast("4.6.5", "4.6.6"), false);
  assert.equal(atLeast("1.10.0", "1.9.9"), true);
  assert.equal(atLeast("8.2.3", "8.2.4"), false);
});

test("packages with a published security fix stay at or above it", () => {
  // name -> first fixed version, from `npm audit` on 11/16.
  const floors = {
    zod: "4.6.6",
    vite: "8.2.4",
    seroval: "1.6.11",
    "js-yaml": "4.3.2",
    "source-map-js": "1.2.2",
    "fast-uri": "3.1.9",
  };
  const below = [];
  for (const [name, floor] of Object.entries(floors)) {
    const found = copies(name);
    assert.ok(found.length, `${name} is in package-lock.json`);
    for (const c of found) if (!atLeast(c.version, floor)) below.push(`${c.path} is ${c.version}, needs ${floor} or later`);
  }
  assert.deepEqual(below, []);
});

test("better-auth below 1.7.7: the three sign-in features with open advisories stay off", () => {
  const [auth] = copies("better-auth");
  assert.ok(auth, "better-auth is in package-lock.json");
  if (atLeast(auth.version, "1.7.7")) return;
  // Magic links (GHSA-965c-763c-88jm), the OAuth proxy (GHSA-r4xp-prcw-77qf), device sign-in (GHSA-q84f-53jg-9ppm).
  assert.deepEqual(using(/\b(magicLink|oAuthProxy|deviceAuthorization)\s*\(/), [], "upgrade better-auth to 1.7.7 or later before turning these on");
});

test("pdf.js below 6.2.108: PDFs are only read for text and pictures, never shown with scripting", () => {
  const [pdfjs] = copies("pdfjs-dist");
  assert.ok(pdfjs, "pdfjs-dist is in package-lock.json");
  if (atLeast(pdfjs.version, "6.2.108")) return;
  // GHSA-hq66-cqwq-w95j runs a PDF's own script through the viewer's form layer.
  assert.deepEqual(using(/AnnotationLayer|enableScripting|pdfjs-dist\/web\//), [], "upgrade pdfjs-dist to 6.2.108 or later before showing PDFs with pdf.js");
});
