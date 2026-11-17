/**
 * Package safety (11/16 audit). Two kinds of check, both read from the files as they are checked in:
 *
 * 1. Fixed packages: no installed copy in package-lock.json sits inside a range that has a published fix, so a
 *    lockfile regenerated from older ranges can't quietly bring an issue back.
 * 2. Held packages: the advisories on two are still open because the fix is a breaking upgrade (better-auth 1.7 changes
 *    the sign-in callback address the Grok broker knows; pdf.js 6 changes how pictures are read out of a PDF).
 *    Each one only bites when a feature KatzDesk doesn't use is switched on. These tests fail the day someone
 *    switches that feature on while the package is still below its fix, which is the day the upgrade stops being optional.
 *
 * Not covered: xlsx. npm has no fixed version, and reading a workbook is the whole use, so there is nothing to guard.
 * Any signed-in desk account can hand the server a workbook to read; that is an accepted risk until the package is
 * replaced with the maker's own 0.20.3 build.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages;

const parts = (v) => v.split("-")[0].split(".").map((n) => Number(n) || 0);
/** True when version a is at or above release b. A pre-release of b (1.7.7-beta.1) is still below it. */
const atLeast = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return !a.includes("-");
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
  assert.equal(atLeast("1.7.7-beta.1", "1.7.7"), false);
  assert.equal(atLeast("1.7.8-beta.1", "1.7.7"), true);
});

test("no installed copy of a package sits inside a range that has a published fix", () => {
  // [package, first affected, first fixed], from `npm audit` on 11/16. A copy outside the range (an older major
  // some tool brings along) isn't this test's business.
  const fixed = [
    ["zod", "0.0.0", "4.6.6"],
    ["vite", "8.2.0", "8.2.4"],
    ["seroval", "1.5.5", "1.6.11"],
    ["js-yaml", "4.0.0", "4.3.2"],
    ["source-map-js", "1.0.0", "1.2.2"],
    ["fast-uri", "3.0.0", "3.1.9"],
    ["brace-expansion", "0.0.0", "1.1.21"],
    ["brace-expansion", "4.0.0", "5.0.12"],
    ["minimatch", "7.0.0", "11.0.1"],
  ];
  // The app's own two; the rest come and go with whatever needs them.
  for (const name of ["zod", "vite"]) assert.ok(copies(name).length, `${name} is in package-lock.json`);
  const inside = [];
  for (const [name, from, fix] of fixed) {
    for (const c of copies(name)) if (atLeast(c.version, from) && !atLeast(c.version, fix)) inside.push(`${c.path} is ${c.version}, needs ${fix} or later`);
  }
  assert.deepEqual(inside, []);
});

test("better-auth below 1.7.7: the sign-in features with open advisories stay off", () => {
  const [auth] = copies("better-auth");
  assert.ok(auth, "better-auth is in package-lock.json");
  if (atLeast(auth.version, "1.7.7")) return;
  // Magic links (GHSA-965c-763c-88jm), the OAuth proxy (GHSA-r4xp-prcw-77qf), device sign-in (GHSA-q84f-53jg-9ppm).
  // Any mention counts, so an import under another name is caught too.
  assert.deepEqual(using(/\b(magicLink|oAuthProxy|deviceAuthorization)\b/), [], "upgrade better-auth to 1.7.7 or later before turning these on");
  // Rate limits kept in PostgreSQL can be overrun (GHSA-44jh-23m7-hpcf). KatzDesk leaves them in memory, the default.
  assert.deepEqual(using(/\brateLimit\s*:/), [], "upgrade better-auth to 1.7.7 or later before configuring rateLimit");
});

test("pdf.js below 6.2.108: PDFs are only read for text and pictures, never shown with scripting", () => {
  const [pdfjs] = copies("pdfjs-dist");
  assert.ok(pdfjs, "pdfjs-dist is in package-lock.json");
  if (atLeast(pdfjs.version, "6.2.108")) return;
  // GHSA-hq66-cqwq-w95j runs a PDF's own script through the viewer's form layer.
  const viewer = /pdfjs-dist\/(legacy\/)?web\/|PDFViewer|PDFScriptingManager|AnnotationLayer|enableScripting|react-pdf/;
  assert.deepEqual(using(viewer), [], "upgrade pdfjs-dist to 6.2.108 or later before showing PDFs with pdf.js");
});
