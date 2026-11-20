import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Chuy, 11/20: labor counts as cost, at one blended labor cost rate an Admin sets. No tech's own pay is stored, and the
// rate itself stays hidden from everyone but an Admin ("Hide pay rates").

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { cleanLaborRate, laborCost } = await import("../src/lib/ops/labor-cost.ts");
const API = await import("../src/lib/ops/part-pricing-api.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("cleanLaborRate: dollars per hour above 0, to the cent; blank clears", () => {
  assert.deepEqual(cleanLaborRate("31"), { rate: 31 });
  assert.deepEqual(cleanLaborRate("$30.555"), { rate: 30.56 });
  assert.deepEqual(cleanLaborRate(28.5), { rate: 28.5 });
  assert.deepEqual(cleanLaborRate(""), { rate: null });
  assert.deepEqual(cleanLaborRate(null), { rate: null });
  for (const bad of ["0", "-5", "abc", "1001"]) assert.ok("error" in cleanLaborRate(bad), bad);
});

test("laborCost: billed hours × the rate; unknown without a rate", () => {
  assert.equal(laborCost(1.5, 31), 46.5);
  assert.equal(laborCost(0.25, 30.5), 7.63);
  assert.equal(laborCost(2, null), null);
});

test("the rate is stored once; only an Admin sets it, and only an Admin is told it", async () => {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (t, p) => (await pg.query(t, p)).rows };
  try {
    assert.equal(await API.loadLaborRate(sql), null);
    await API.saveLaborRate(sql, 31);
    assert.equal(await API.loadLaborRate(sql), 31);
    await API.saveLaborRate(sql, 33.25);
    assert.equal(await API.loadLaborRate(sql), 33.25);
    await pg.query("update desk_settings set value = 'nope' where key = 'labor_cost_rate'");
    assert.equal(await API.loadLaborRate(sql), null, "a bad stored value is no rate");
    await API.saveLaborRate(sql, null);
    assert.equal((await pg.query("select 1 from desk_settings where key = 'labor_cost_rate'")).rows.length, 0);
  } finally {
    await pg.close();
  }
  const api = src("src/lib/ops/part-pricing-api.ts");
  const get = api.slice(api.indexOf("export const getLaborRate"), api.indexOf("export const setLaborRate"));
  assert.match(get, /rate: canEdit \? rate : null/, "the number goes only to an Admin");
  const set = api.slice(api.indexOf("export const setLaborRate"));
  assert.match(set.slice(0, set.indexOf("});")), /await requireAdmin\(sql, context\.userId\);/);
  assert.match(src("src/routes/_app/settings.tsx"), /<LaborRateEditor \/>/);
});
