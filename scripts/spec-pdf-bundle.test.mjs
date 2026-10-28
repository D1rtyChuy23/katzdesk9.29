// The BUILT server PDF reader (10/28). Production failed on every file because the bundled reader needed pdf.js's
// worker file and @napi-rs/canvas from node_modules, which the Vercel function doesn't ship. This copies the built
// spec-pdf chunk from .vercel/output, with the chunks it imports, into a folder that has no node_modules anywhere above
// it, and reads a small PDF made here with it. Run `npx vite build` first; the test is skipped when there is no build,
// or the build is older than the reader's source.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { makePdf } from "./pdf-fixture.mjs";

const FUNC = new URL("../.vercel/output/functions/__server.func/", import.meta.url).pathname;
const SOURCE = new URL("../src/lib/ops/spec-pdf.server.ts", import.meta.url).pathname;

function builtReaders() {
  if (!existsSync(FUNC)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name === "node_modules") continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (/^spec-pdf\.server.*\.mjs$/.test(name)) out.push(path);
    }
  };
  walk(FUNC);
  return out;
}

const readers = builtReaders();
const stale = readers.length && readers.some((f) => statSync(f).mtimeMs < statSync(SOURCE).mtimeMs);
const skip = !readers.length ? "no build in .vercel/output: run npx vite build first" : stale ? "the build is older than spec-pdf.server.ts: run npx vite build" : false;

/** Copy a built file and every file it imports by a relative path (static or dynamic) into `to`; bare imports are returned. */
function copyWithImports(file, from, to, seen = new Set(), bare = new Set()) {
  if (seen.has(file)) return bare;
  seen.add(file);
  const text = readFileSync(file, "utf8");
  const dest = join(to, relative(from, file));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
  // A module specifier: no spaces and no template holes ("${e}" inside a message is not an import).
  for (const m of text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'\s$]+)["']/g)) {
    const spec = m[1];
    if (spec.startsWith("./") || spec.startsWith("../")) copyWithImports(resolve(dirname(file), spec), from, to, seen, bare);
    else if (!spec.startsWith("node:")) bare.add(spec);
  }
  return bare;
}

test("the built reader reads every page of a PDF with no node_modules", { skip }, () => {
  const reader = readers.find((f) => f.includes("/_chunks/")) ?? readers[0];
  const dir = mkdtempSync(join(tmpdir(), "spec-pdf-probe-"));
  try {
    for (let d = dir; d !== dirname(d); d = dirname(d)) assert.equal(existsSync(join(d, "node_modules")), false, `${d} has node_modules`);
    const bare = copyWithImports(reader, FUNC, dir);
    assert.deepEqual([...bare], [], "the reader imports no package from node_modules");
    writeFileSync(join(dir, "probe.pdf"), makePdf([["ACME Brewer X1", "Installation Manual"], ["Technical Data", "Voltage 120 V", "Amps 15 A"], []]));
    const chunk = `./${relative(dir, join(dir, relative(FUNC, reader)))}`;
    writeFileSync(
      join(dir, "probe.mjs"),
      `import { readFileSync } from "node:fs";
const { pdfPages } = await import(${JSON.stringify(chunk)});
const read = await pdfPages(new Uint8Array(readFileSync(new URL("./probe.pdf", import.meta.url))));
console.log(JSON.stringify(read));`,
    );
    const run = spawnSync(process.execPath, ["probe.mjs"], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH ?? "" }, timeout: 120_000 });
    assert.equal(run.status, 0, run.stderr);
    const read = JSON.parse(run.stdout.trim().split("\n").pop());
    assert.deepEqual(read, { totalPages: 3, pages: ["ACME Brewer X1\nInstallation Manual", "Technical Data\nVoltage 120 V\nAmps 15 A", ""] });
    console.log(`built reader ${relative(FUNC, reader)}: ${readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".mjs")).length - 1} files, read ${read.totalPages} pages`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
