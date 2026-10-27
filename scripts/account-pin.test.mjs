// Restore removed accounts (including ones removed before Remove recorded who and when) and a map pin entered by hand
// on Account Details (Grok via Chuy, 10/26). All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { restoreCustomersFor, listRemovedCustomersFor } = await import("../src/lib/ops/customer-remove-api.ts");
const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
const { setAccountPinFor } = await import("../src/lib/ops/account-pin-api.ts");
const { parsePinInput, pinQuality, pinSourceLabel, MANUAL_PIN_SOURCE } = await import("../src/lib/ops/account-pin.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    "insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin'), ('u-tech', 'melinda', true, false, 'service')",
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
const account = async (sql, name, extra = {}) =>
  (await sql.query("insert into directory_customers (name, account_number, netsuite_id, archived) values ($1, $2, $3, $4) returning id", [name, extra.number ?? null, extra.netsuite ?? null, !!extra.archived]))[0].id;

test("pin input: decimals only, both numbers, a point in the lower 48, swapped numbers caught; a pasted pair works", () => {
  assert.deepEqual(parsePinInput("29.91191201363738", "-95.72461707631616"), { ok: true, lat: 29.91191201363738, lng: -95.72461707631616 });
  assert.deepEqual(parsePinInput("29.91191201363738, -95.72461707631616", ""), { ok: true, lat: 29.91191201363738, lng: -95.72461707631616 });
  assert.match(parsePinInput("-95.7246", "29.9119").reason, /look swapped/);
  assert.match(parsePinInput("29.9119", "95.7246").reason, /outside the continental US/);
  assert.match(parsePinInput("29°54'N", "-95.72").reason, /decimal numbers/);
  assert.match(parsePinInput("29.9", "").reason, /both the latitude and the longitude/);
  assert.match(parsePinInput("129.9", "-95.7").reason, /-90 to 90/);
  assert.equal(pinQuality("manual"), "exact", "a hand-entered pin is a street pin");
  assert.equal(pinQuality("close"), "close");
  assert.equal(pinSourceLabel("manual"), "Manual (entered by user)");
});

test("an admin's pin saves on the same account, as Manual (entered by user), with a history line; others can't", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await account(sql, "Pin Test Cafe", { number: "5001" });
    await sql.query("update directory_customers set latitude = 29.7, longitude = -95.4, geocode_match = 'approx' where id = $1", [id]);
    await assert.rejects(() => setAccountPinFor(sql, "u-tech", { id, latitude: "29.9", longitude: "-95.7" }), /Only an admin/);
    await assert.rejects(() => setAccountPinFor(sql, "u-owner", { id, latitude: "-95.7", longitude: "29.9" }), /look swapped/);
    const saved = await setAccountPinFor(sql, "u-owner", { id, latitude: "29.91191201363738", longitude: "-95.72461707631616" });
    assert.deepEqual(saved, { latitude: 29.91191201363738, longitude: -95.72461707631616, source: MANUAL_PIN_SOURCE });
    const r = (await sql.query("select latitude, longitude, geocode_match, geocode_address, account_number from directory_customers where id = $1", [id]))[0];
    assert.deepEqual(
      { lat: Number(r.latitude), lng: Number(r.longitude), match: r.geocode_match, source: r.geocode_address, number: r.account_number },
      { lat: 29.91191201363738, lng: -95.72461707631616, match: "manual", source: "Manual (entered by user)", number: "5001" },
    );
    const log = await sql.query("select actor_name, detail from activity where entity_type = 'customer' and entity_id = $1", [id]);
    assert.deepEqual(log, [{ actor_name: "chuy", detail: "Map pin entered by hand: 29.911912, -95.724617 (was 29.700000, -95.400000)" }]);
  } finally {
    await pg.close();
  }
});

test("Removed also lists an account removed before 10/26 that still has history; a merged or empty one stays off", async () => {
  const { pg, sql } = await fresh();
  try {
    // An older removal: archived with no removed_at, its calls and equipment still under its name.
    const old = await account(sql, "Star Test Grill - Cypress", { number: "7007", netsuite: "NS-7007", archived: true });
    await sql.query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-OLD', 'Star Test Grill - Cypress', 'Completed')");
    await sql.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Star Test Grill - Cypress', 'Bunn TB3', 'Bunn TB3', 'TB-777', 'tb-777')");
    // A merged account: its history moved to the kept one, so nothing is left under its name.
    await account(sql, "Kept Shop");
    const dup = await account(sql, "Dup Shop");
    await sql.query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-DUP', 'Dup Shop', 'Open')");
    await renameOrMergeCustomer(sql, dup, "Kept Shop");
    await account(sql, "Empty Long Ago", { archived: true });

    const removed = await listRemovedCustomersFor(sql);
    assert.deepEqual(removed.map((r) => [r.name, r.earlier, r.removedAt, r.history]), [["Star Test Grill - Cypress", true, null, 2]]);
    assert.deepEqual((await restoreCustomersFor(sql, "u-owner", [dup])).restored, [], "a merged account isn't restored");

    const res = await restoreCustomersFor(sql, "u-owner", [old]);
    assert.deepEqual(res.restored, [{ id: old, name: "Star Test Grill - Cypress" }]);
    // The same record comes back: same id, Account #, NetSuite ID, call and equipment.
    const r = (await sql.query("select id, archived, account_number, netsuite_id from directory_customers where id = $1", [old]))[0];
    assert.deepEqual(r, { id: old, archived: false, account_number: "7007", netsuite_id: "NS-7007" });
    assert.equal((await sql.query("select count(*)::int n from directory_customers where lower(name) = lower('Star Test Grill - Cypress')"))[0].n, 1, "no new account");
    assert.equal((await sql.query("select customer from service_jobs where call_id = 'SC-OLD'"))[0].customer, "Star Test Grill - Cypress");
    assert.deepEqual(await sql.query("select actor_name, action from activity where entity_type = 'customer' and entity_id = $1", [old]), [{ actor_name: "chuy", action: "restored" }]);

    // Then the pin, as in Grok's first use.
    await setAccountPinFor(sql, "u-owner", { id: old, latitude: "29.91191201363738", longitude: "-95.72461707631616" });
    assert.equal((await sql.query("select geocode_match from directory_customers where id = $1", [old]))[0].geocode_match, "manual");
  } finally {
    await pg.close();
  }
});

test("a pin can't go on a removed account until it is restored", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await account(sql, "Still Removed", { archived: true });
    await assert.rejects(() => setAccountPinFor(sql, "u-owner", { id, latitude: "29.9", longitude: "-95.7" }), /Restore it first/);
  } finally {
    await pg.close();
  }
});
