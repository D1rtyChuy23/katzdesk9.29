import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

// The Admin desk role gets what the admin flag gets (Chuy, 11/9), except managing accounts and Warehouse's alerts.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { isAdminAccount, isDeskAdmin } = await import("../src/lib/ops/admin-role.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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

test("Warehouse's rack, stock, module and pull alerts still go to the owner flag only (Chuy, 10/29)", () => {
  const notify = src("src/lib/ops/notify.ts");
  assert.equal((notify.match(/if \(!flagOn\(admin\.is_admin\) \|\| !flagOn\(admin\.approved\)\) continue;/g) ?? []).length, 4);
  assert.doesNotMatch(notify, /isAdminAccount/);
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
