import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the Map's data gives every viewer the work counts on every account (no sales-rep zeroing)", () => {
  const api = src("src/lib/ops/geo-api.ts");
  assert.ok(!/salesRepScope/.test(api), "geo-api must not scope work counts by sales rep");
  assert.match(api, /const counts = !dup;/);
  assert.ok(!/scoped: /.test(api));
  assert.ok(!/nearby-scoped/.test(src("src/components/desk/nearby-accounts.tsx")));
});

test("Accounts tab: My View never hides accounts; it only starts a sales rep's Rep filter on their own name", () => {
  const map = src("src/components/desk/customer-map.tsx");
  assert.ok(!/scoped && !\(a\.aviKatz \|\| matchMine\(a\.rep\)\)/.test(map), "the hard My View filter is gone");
  assert.match(map, /const mine = scoped \? \(data\?\.reps\.find\(\(r\) => matchMine\(r\)\) \?\? null\) : null;/);
  assert.match(map, /if \(!repPicked\.current\) setRep\(mine \?\? ""\);/);
  assert.match(map, /<RepFilter value=\{rep\} onChange=\{pickRep\}/);
  // An account opened by link clears a Rep filter that would hide it.
  assert.match(map, /setRep\(\(cur\) => \{\s*if \(!cur \|\| \(cur === "__none__" \? !a\.rep : a\.rep === cur\)\) return cur;/);
  assert.ok(!/Work counts cover your own accounts only/.test(map));
});

test("Territories tab: every rep's card and pins show; My View only starts on the rep's own card", () => {
  const view = src("src/components/desk/territory-view.tsx");
  assert.ok(!/inScope/.test(view), "no My View scope on cards or pins");
  assert.match(view, /if \(picked\.current\) return;\s*setShown\(mine\);/);
  assert.ok(!/your accounts only \(My View\)/.test(view));
});
