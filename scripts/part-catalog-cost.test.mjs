import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Chuy, 11/20: everyone sees our cost and the margin on the Parts catalog. Cost is the NetSuite Purchase Price, else
// Our Discount Rule on the manufacturer price, else not set.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { listPartsFor } = await import("../src/lib/ops/parts-api.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-svc', 'zz.service', true, false, 'service')");
  const add = (sku, rate, list, cost) =>
    pg.query("insert into billing_items (sku, item, mfr_part, description, rate, list_price, cost) values ($1, $1, $1, 'x', $2, $3, $4)", [sku, rate, list, cost]);
  await add("ZZ-PP", 100, 90, 40);
  await add("ZZ-RULE", 100, 80, null);
  await add("ZZ-ZERO", 100, null, 0);
  await add("ZZ-NORATE", null, null, 25);
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}

test("the Parts list gives everyone each part's cost, its source and the margin on its price", async () => {
  const { pg, sql } = await db();
  try {
    await pg.query("insert into desk_settings (key, value) values ('our_discount_rule', $1)", [JSON.stringify({ mode: "percent", value: 25 })]);
    const page = await listPartsFor(sql, { q: "ZZ-" }, "u-svc");
    const by = Object.fromEntries(page.rows.map((r) => [r.sku, r]));
    assert.deepEqual([by["ZZ-PP"].purchasePrice, by["ZZ-PP"].cost, by["ZZ-PP"].costSource, by["ZZ-PP"].margin, by["ZZ-PP"].marginPct], [40, 40, "purchase", 60, 60]);
    assert.deepEqual([by["ZZ-RULE"].cost, by["ZZ-RULE"].costSource, by["ZZ-RULE"].margin], [60, "rule", 40]);
    assert.deepEqual([by["ZZ-ZERO"].cost, by["ZZ-ZERO"].costSource, by["ZZ-ZERO"].margin, by["ZZ-ZERO"].marginPct], [null, "none", null, null]);
    assert.deepEqual([by["ZZ-NORATE"].cost, by["ZZ-NORATE"].margin], [25, null], "no price, no margin");
  } finally {
    await pg.close();
  }
});

test("with no discount rule set, a part with no Purchase Price has no cost", async () => {
  const { pg, sql } = await db();
  try {
    const page = await listPartsFor(sql, { q: "ZZ-RULE" }, "u-svc");
    assert.deepEqual([page.rows[0].cost, page.rows[0].costSource], [null, "none"]);
  } finally {
    await pg.close();
  }
});

test("the list and the part window show cost and margin, with no admin gate", () => {
  const list = src("src/routes/_app/parts.tsx");
  assert.match(list, /data-testid="part-cost"/);
  const win = src("src/components/desk/part-window.tsx");
  assert.match(win, /data-testid="part-window-cost"/);
  assert.match(win, /data-testid="part-window-margin"/);
});
