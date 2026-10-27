// Customers admin actions follow the Admin role as well as the desk-admin flag (Chuy, 2026-10-27): the Removed list,
// Remove, Restore, Rename / merge and the hand-entered map pin. Sales, Service and Warehouse still can't, and an
// Admin-role account that isn't approved can't either. Made-up accounts and users only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { removeCustomersFor, restoreCustomersFor, listRemovedCustomersAs } = await import("../src/lib/ops/customer-remove-api.ts");
const { renameCustomerFor } = await import("../src/lib/ops/customer-identity.ts");
const { setAccountPinFor } = await import("../src/lib/ops/account-pin-api.ts");
const { canReviewNames } = await import("../src/lib/ops/access.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

/** Who's who: one desk admin, one Admin-role account (no desk-admin flag), the other roles, and an unapproved Admin. */
const PEOPLE = [
  ["u-owner", "owner.test", true, true, null],
  ["u-admin", "adminrole.test", true, false, "admin"],
  ["u-sales", "sales.test", true, false, "sales"],
  ["u-service", "service.test", true, false, "service"],
  ["u-warehouse", "warehouse.test", true, false, "warehouse"],
  ["u-pending", "pending.test", false, false, "admin"],
];
const NOT_ALLOWED = ["u-sales", "u-service", "u-warehouse", "u-pending"];

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  for (const [id, username, approved, admin, role] of PEOPLE) {
    await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ($1, $2, $3, $4, $5)", [id, username, approved, admin, role]);
  }
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
const account = async (sql, name, extra = {}) =>
  (await sql.query("insert into directory_customers (name, archived) values ($1, $2) returning id", [name, !!extra.archived]))[0].id;
const state = async (sql, id) => (await sql.query("select name, archived, removed_by from directory_customers where id = $1", [id]))[0];

test("who counts as a Customers admin: a desk admin or the Admin role, approved", async () => {
  const { pg, sql } = await fresh();
  try {
    const allowed = {};
    for (const [id] of PEOPLE) allowed[id] = await canReviewNames(sql, id);
    assert.deepEqual(allowed, { "u-owner": true, "u-admin": true, "u-sales": false, "u-service": false, "u-warehouse": false, "u-pending": false });
  } finally {
    await pg.close();
  }
});

test("the Admin role can remove, see the Removed list and restore; other roles can't", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await account(sql, "Test Cafe One");
    const b = await account(sql, "Test Cafe Two");
    for (const who of NOT_ALLOWED) {
      await assert.rejects(() => removeCustomersFor(sql, who, [a]), /Only an admin can add or remove customers/, `${who} can't remove`);
    }
    const res = await removeCustomersFor(sql, "u-admin", [a]);
    assert.deepEqual(res.removed.map((r) => r.name), ["Test Cafe One"]);
    assert.deepEqual(await state(sql, a), { name: "Test Cafe One", archived: true, removed_by: "adminrole.test" });

    for (const who of NOT_ALLOWED) {
      await assert.rejects(() => listRemovedCustomersAs(sql, who), /Only an admin can see removed customers/, `${who} can't see Removed`);
    }
    assert.deepEqual((await listRemovedCustomersAs(sql, "u-admin")).map((r) => r.name), ["Test Cafe One"]);
    assert.deepEqual((await listRemovedCustomersAs(sql, "u-owner")).map((r) => r.name), ["Test Cafe One"], "the desk admin still sees it");

    for (const who of NOT_ALLOWED) {
      await assert.rejects(() => restoreCustomersFor(sql, who, [a]), /Only an admin/, `${who} can't restore`);
    }
    const back = await restoreCustomersFor(sql, "u-admin", [a]);
    assert.deepEqual(back.restored.map((r) => r.name), ["Test Cafe One"]);
    assert.equal((await state(sql, a)).archived, false);

    // The desk admin's own path is unchanged.
    await removeCustomersFor(sql, "u-owner", [b]);
    assert.equal((await state(sql, b)).removed_by, "owner.test");
    await restoreCustomersFor(sql, "u-owner", [b]);
    assert.equal((await state(sql, b)).archived, false);
  } finally {
    await pg.close();
  }
});

test("the Admin role can rename and merge; other roles can't", async () => {
  const { pg, sql } = await fresh();
  try {
    const child = await account(sql, "Walk - In:Test Bakery");
    const keep = await account(sql, "Test Diner");
    const dupe = await account(sql, "Test Diner (old)");
    await sql.query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-T1', 'Test Diner (old)', 'Completed')");
    for (const who of NOT_ALLOWED) {
      await assert.rejects(() => renameCustomerFor(sql, who, child, "Test Bakery"), /Only an admin can rename or merge customers/, `${who} can't rename`);
    }
    assert.equal((await state(sql, child)).name, "Walk - In:Test Bakery", "nothing changed for them");

    const renamed = await renameCustomerFor(sql, "u-admin", child, "Test Bakery");
    assert.deepEqual([renamed.name, renamed.merged], ["Test Bakery", false]);

    // A merge needs a yes for the account the rename window showed (customer-rename-merge.test.mjs).
    const merged = await renameCustomerFor(sql, "u-admin", dupe, "Test Diner", { confirmMerge: keep });
    assert.deepEqual([merged.id, merged.name, merged.merged], [keep, "Test Diner", true]);
    assert.equal((await state(sql, dupe)).archived, true, "the merged account is off the list");
    assert.equal((await sql.query("select customer from service_jobs where call_id = 'SC-T1'"))[0].customer, "Test Diner", "its ticket moved");

    const owner = await renameCustomerFor(sql, "u-owner", keep, "Test Diner - Main St");
    assert.equal(owner.name, "Test Diner - Main St", "the desk admin's own path is unchanged");
  } finally {
    await pg.close();
  }
});

test("the Admin role can enter a map pin; other roles can't", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await account(sql, "Test Grill - Cypress");
    for (const who of NOT_ALLOWED) {
      await assert.rejects(() => setAccountPinFor(sql, who, { id, latitude: "29.9", longitude: "-95.7" }), /Only an admin can change an account's map pin/, `${who} can't pin`);
    }
    const saved = await setAccountPinFor(sql, "u-admin", { id, latitude: "29.911912, -95.724617", longitude: "" });
    assert.deepEqual(saved, { latitude: 29.911912, longitude: -95.724617, source: "Manual (entered by user)" });
    const pin = (await sql.query("select latitude, longitude, geocode_match from directory_customers where id = $1", [id]))[0];
    assert.deepEqual([Number(pin.latitude), Number(pin.longitude), pin.geocode_match], [29.911912, -95.724617, "manual"]);
    const log = (await sql.query("select actor_name, detail from activity where entity_type = 'customer' and entity_id = $1", [id]))[0];
    assert.equal(log.actor_name, "adminrole.test");
    assert.match(log.detail, /Map pin entered by hand: 29\.911912, -95\.724617/);
  } finally {
    await pg.close();
  }
});
