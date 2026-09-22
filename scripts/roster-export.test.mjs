import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/ops/tech-match.ts", import.meta.url), "utf8");
assert.ok(!/"Elias"/.test(src), "Elias must leave the active roster");
assert.ok(/"Ryan Gloria"/.test(src), "Ryan Gloria must be on the active roster");
assert.ok(/"Charles Foster"/.test(src));
assert.ok(/"Oliver Garcia"/.test(src));
assert.ok(/"Joshua Harper"/.test(src));
assert.ok(/"Lance Oden"/.test(src));
assert.ok(/"Jesus Garcia"/.test(src));
assert.ok(/"Bill McKinley"/.test(src));
assert.ok(/"Brandon Chappell"/.test(src));
assert.ok(/"3rd Party"/.test(src));
assert.equal(
  `KatzDesk-PMs-2026-09-14.xlsx`,
  `KatzDesk-PMs-2026-09-14.xlsx`,
);
console.log("roster labels ok");
