import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The Admin desk role gets what the admin flag gets (Chuy, 11/9), except managing accounts. Made-up users only.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { isAdminAccount, isDeskAdmin } = await import("../src/lib/ops/admin-role.ts");
const N = await import("../src/lib/ops/notify.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const MIGRATIONS = new URL("../migrations/", import.meta.url);

test("an admin is the admin flag or the Admin role", () => {
  assert.equal(isAdminAccount({ is_admin: true, desk_role: null }), true);
  assert.equal(isAdminAccount({ is_admin: "t", desk_role: "service" }), true);
  assert.equal(isAdminAccount({ is_admin: false, desk_role: "admin" }), true);
  assert.equal(isAdminAccount({ is_admin: false, desk_role: " Admin " }), true);
  assert.equal(isAdminAccount({ is_admin: false, desk_role: "warehouse" }), false);
  assert.equal(isAdminAccount({ is_admin: false, desk_role: "sales" }), false);
  assert.equal(isAdminAccount(null), false);
  assert.equal(isAdminAccount(undefined), false);
  assert.equal(isDeskAdmin({ isAdmin: true, role: null }), true);
  assert.equal(isDeskAdmin({ isAdmin: false, role: "admin" }), true);
  assert.equal(isDeskAdmin({ isAdmin: false, role: "service" }), false);
  assert.equal(isDeskAdmin(null), false);
});

test("admin alerts reach the admin flag and the Admin role, approved only, never the sender", async () => {
  const pg = new PGlite();
  try {
    for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const query = async (text, params) => (await pg.query(text, params)).rows;
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    await query(
      `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
         ('u-flag', 'boss', true, true, null),
         ('u-role', 'ana', true, false, 'admin'),
         ('u-role-off', 'nora', false, false, 'admin'),
         ('u-tech', 'tess', true, false, 'service'),
         ('u-wh', 'walt', true, false, 'warehouse')`,
    );
    const got = async () => (await query("select user_id from desk_notifications order by user_id")).map((r) => r.user_id);
    const clear = () => query("delete from desk_notifications");

    await N.notifyAdminsWarehousePull(sql, "u-wh", { rebuildId: 1, account: "Test Shop", body: "Test pull." });
    assert.deepEqual(await got(), ["u-flag", "u-role"]);
    await clear();
    await N.notifyAdminsModuleReturn(sql, "u-wh", { id: 1, moduleId: "TM-1", moduleType: "Brew Module", customer: "Test Cafe" });
    assert.deepEqual(await got(), ["u-flag", "u-role"]);
    await clear();
    await N.notifyAdminsStockRequest(sql, "u-wh", { id: 1, kind: "remove", model: "Test Brewer", serial: "TB-1", slot: "A1", reason: "test", customer: null });
    assert.deepEqual(await got(), ["u-flag", "u-role"]);
    await clear();
    await N.notifyAdminsRackReview(sql, "u-wh", { id: 1, model: "Test Brewer", serial: "TB-1", slot: "A1" });
    assert.deepEqual(await got(), ["u-flag", "u-role"]);
    await clear();
    // The Admin role's own pull doesn't ping itself.
    await N.notifyAdminsWarehousePull(sql, "u-role", { rebuildId: 1, account: "Test Shop", body: "Test pull." });
    assert.deepEqual(await got(), ["u-flag"]);
  } finally {
    await pg.close();
  }
});

test("each server check that named only the admin flag now takes the Admin role too", () => {
  for (const file of ["stock-actions.ts", "rack-stock.ts", "module-assign.ts"]) assert.match(src(`src/lib/ops/${file}`), /admin: isAdminAccount\(row\[0\]\),/, file);
  assert.match(src("src/lib/ops/unofficial-sources.ts"), /editor: isAdminAccount\(rows\[0\]\) \|\| rows\[0\]\?\.desk_role === "sales"/);
  assert.match(src("src/lib/ops/api.ts"), /if \(!me \|\| !\(isAdminAccount\(me\) \|\| me\.desk_role === "sales"\)\) throw new Error\("Only Sales can mark the Tech Request Form as issued\."\)/);
  const access = src("src/lib/ops/access.ts");
  assert.match(access, /if \(isAdminAccount\(me\[0\]\) \|\| flagOn\(me\[0\]\.can_add_customers\)\) return;/);
  assert.match(access, /canAddCustomers: isAdminAccount\(row\) \|\| flagOn\(row\.can_add_customers\),/);
  // Managing accounts stays with the admin flag.
  assert.match(access, /if \(!flagOn\(me\[0\]\?\.is_admin\)\) throw new Error\(message \?\? "Only an admin can review accounts\."\);/);
});

test("the screens that named only the admin flag now take the Admin role too", () => {
  assert.match(src("src/components/desk/module-assign.tsx"), /const admin = isDeskAdmin\(me\.data\);/);
  const asset = src("src/components/desk/asset-sheet.tsx");
  assert.match(asset, /const admin = isDeskAdmin\(me\.data\);\n\s+const canStock = admin \|\| warehouseOnly;/);
  assert.match(asset, /\{admin && asset\.reviewStatus === "pending" \? \(/);
  assert.match(asset, /<StockActions asset=\{asset\} canStock=\{canStock\} isAdmin=\{admin\} \/>/);
  assert.match(src("src/components/desk/directory-fields.tsx"), /const isAdmin = isDeskAdmin\(me\.data\);/);
  assert.match(src("src/routes/_app/customers.tsx"), /const isAdmin = isDeskAdmin\(me\.data\);/);
  for (const page of ["locations.tsx", "warehouse.tsx"]) assert.match(src(`src/routes/_app/${page}`), /const canStock = isDeskAdmin\(me\.data\) \|\| me\.data\?\.role === "warehouse";/, page);
});
