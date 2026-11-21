import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Chuy, 11/20: a toggle for who sees our cost and margin, and "keep everyone from seeing it": an Admin always sees it;
// every other role is off until an Admin turns it on. The server leaves the numbers out, not just the screen.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const CA = await import("../src/lib/ops/cost-access.ts");
const { listPartsFor } = await import("../src/lib/ops/parts-api.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const people = [
    ["u-owner", true, true, null],
    ["u-admin", true, false, "admin"],
    ["u-sales", true, false, "sales"],
    ["u-svc", true, false, "service"],
    ["u-wh", true, false, "warehouse"],
    ["u-none", true, false, null],
    ["u-wait", false, false, "admin"],
  ];
  for (const [id, approved, flag, role] of people) {
    await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ($1, $1, $2, $3, $4)", [id, approved, flag, role]);
  }
  await pg.query("insert into billing_items (sku, item, mfr_part, description, rate, cost) values ('ZZ-1', 'ZZ-1', 'ZZ-1', 'x', 100, 40)");
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}

test("cleanCostRoles keeps only the known roles, once each, in order", () => {
  assert.deepEqual(CA.cleanCostRoles(["warehouse", "sales", "sales", "admin", "boss", 3]), ["sales", "warehouse"]);
  assert.deepEqual(CA.cleanCostRoles("nope"), []);
  assert.deepEqual(CA.COST_ROLES.map((r) => r.role), ["sales", "service", "warehouse", "none"]);
});

test("by default only an Admin sees cost; a role an Admin turns on sees it too", async () => {
  const { pg, sql } = await db();
  try {
    const who = async () => Object.fromEntries(await Promise.all(["u-owner", "u-admin", "u-sales", "u-svc", "u-wh", "u-none", "u-wait", "u-nobody"].map(async (u) => [u, await CA.canSeeCost(sql, u)])));
    assert.deepEqual(await who(), { "u-owner": true, "u-admin": true, "u-sales": false, "u-svc": false, "u-wh": false, "u-none": false, "u-wait": false, "u-nobody": false });
    await CA.saveCostRoles(sql, ["service", "none"]);
    assert.deepEqual(await CA.loadCostRoles(sql), ["service", "none"]);
    const after = await who();
    assert.deepEqual([after["u-svc"], after["u-none"], after["u-sales"], after["u-wh"], after["u-wait"]], [true, true, false, false, false]);
    await pg.query("update desk_settings set value = 'garbage' where key = 'cost_visible_roles'");
    assert.deepEqual(await CA.loadCostRoles(sql), [], "a bad stored value hides cost");
  } finally {
    await pg.close();
  }
});

test("the Parts list leaves cost and margin out for a role that can't see them", async () => {
  const { pg, sql } = await db();
  try {
    const hidden = await listPartsFor(sql, { q: "ZZ-1" }, "u-svc");
    assert.equal(hidden.showCost, false);
    const h = hidden.rows[0];
    assert.deepEqual([h.purchasePrice, h.cost, h.costSource, h.margin, h.marginPct, h.listPrice], [null, null, "none", null, null, null], "the Mfr price is left out too: with the rule it gives the cost");
    const admin = await listPartsFor(sql, { q: "ZZ-1" }, "u-admin");
    assert.equal(admin.showCost, true);
    assert.deepEqual([admin.rows[0].cost, admin.rows[0].margin], [40, 60]);
    await CA.saveCostRoles(sql, ["service"]);
    assert.equal((await listPartsFor(sql, { q: "ZZ-1" }, "u-svc")).rows[0].cost, 40);
  } finally {
    await pg.close();
  }
});

test("only an Admin changes who sees cost; the screens hide it when it isn't sent", () => {
  const api = src("src/lib/ops/part-pricing-api.ts");
  const set = api.slice(api.indexOf("export const setCostAccess"));
  assert.match(set.slice(0, set.indexOf("});")), /await requireAdmin\(sql, context\.userId\);/);
  const parts = src("src/lib/ops/parts-api.ts");
  assert.match(parts, /export const getPart = [\s\S]*?canSeeCost\(sql, context\.userId\)/);
  assert.match(src("src/routes/_app/parts.tsx"), /row\.showCost && row\.kind !== "trip"/);
  assert.match(src("src/components/desk/part-window.tsx"), /row\.showCost && row\.kind !== "trip"/);
  assert.match(src("src/routes/_app/settings.tsx"), /<CostAccessEditor \/>/);
});
