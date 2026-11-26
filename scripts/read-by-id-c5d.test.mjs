// Reading by id, phase C5 part 4 ("One Record Per Machine Plan", Chuy approved 11/24): the Map and the Address Report.
// The Map's per-account counts (open calls, TLCs, past due, PMs, installs, the Out Of Network mark) and the Address
// Report's invoice bill-to addresses go by each account's id once the Map switch on Link Check is on. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { readByIdFor, READ_AREAS } = await import("../src/lib/ops/read-by-id.ts");
const { accountGeoSql } = await import("../src/lib/ops/geo-api.ts");
const { billsSql, loadSources } = await import("../src/lib/ops/address-report-api.ts");

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const q = async (t, p) => (await pg.query(t, p)).rows;
  await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  await q("insert into directory_customers (name) values ('ZZ Map Cafe'), ('ZZ Map Other')");
  const ids = Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
  return { q, sql: { query: q }, cafe: ids["ZZ Map Cafe"], other: ids["ZZ Map Other"] };
}
const mapOn = (q) =>
  q("insert into desk_settings (key, value) values ('read_by_id', $1) on conflict (key) do update set value = excluded.value", [
    JSON.stringify({ map: { at: "2026-11-26T14:00:00Z", by: "zzadmin" } }),
  ]);
const setId = (q, table, id, to) => q(`update ${table} set customer_id = $2 where id = $1`, [id, to]);
let seq = 0;

test("the Map and Address Report is its own area", () => {
  assert.deepEqual(READ_AREAS.map((a) => a.area), ["accounts", "tickets", "pms", "map"]);
});

test("the Map's counts: by name, then by id", async () => {
  const { q, cafe, other } = await fresh();
  const ticket = async (name, kind = "service") =>
    (await q("insert into service_jobs (kind, call_id, customer, status, scheduled) values ($1, $2, $3, 'Open', current_date - 3) returning id", [kind, `SC-ZZM${++seq}`, name]))[0].id;
  await ticket("ZZ Map Cafe");
  await ticket("ZZ Map Cafe ", "tlc"); // spaces at the end: the rule links it, the capitals match doesn't
  const drift = await ticket("ZZ Map Cafe");
  await setId(q, "service_jobs", drift, other);
  const pm = (await q("insert into pm_jobs (customer, status, projected) values ('ZZ Map Old', 'Pending Scheduling', current_date + 5) returning id"))[0].id;
  await setId(q, "pm_jobs", pm, cafe); // a rename left the old name
  const prov = (await q("insert into network_providers (name) values ('ZZ Repair') returning id"))[0].id;
  await q("insert into customer_providers (customer, provider_id, role) values ('ZZ Map Cafe ', $1, 'primary')", [prov]);
  const rows = async (byId) => Object.fromEntries((await q(accountGeoSql(byId), ["2026-11-26", 14])).map((r) => [r.name, r]));
  const a = await rows(false);
  assert.deepEqual([a["ZZ Map Cafe"].open_calls, a["ZZ Map Cafe"].open_tlcs, a["ZZ Map Cafe"].past_due_calls, a["ZZ Map Cafe"].open_pms, a["ZZ Map Cafe"].out_of_network], [2, 0, 2, 0, false]);
  assert.equal(a["ZZ Map Other"].open_calls, 0);
  const b = await rows(true);
  assert.deepEqual([b["ZZ Map Cafe"].open_calls, b["ZZ Map Cafe"].open_tlcs, b["ZZ Map Cafe"].past_due_calls, b["ZZ Map Cafe"].open_pms, b["ZZ Map Cafe"].pms_due_soon, b["ZZ Map Cafe"].out_of_network], [1, 1, 2, 1, 1, true]);
  assert.equal(b["ZZ Map Other"].open_calls, 1);
});

test("the Address Report's invoice bill-to addresses: by name, then by id", async () => {
  const { q, sql, cafe } = await fresh();
  const install = async () => (await q("insert into installs (customer, equipment) values ('ZZ Map Cafe', 'G') returning id"))[0].id;
  await q("insert into invoices (entity_type, entity_id, customer, customer_id, bill_address) values ('install', $1, 'ZZ Map Old', $2, '12 Old Rd, Austin TX 78701')", [await install(), cafe]);
  await q("insert into invoices (entity_type, entity_id, customer, bill_address) values ('install', $1, 'ZZ Map Cafe', '1 Main St, Austin TX 78701')", [await install()]);
  const keyed = async (byId) => (await q(`select * from (${billsSql(byId)}) b`)).map((r) => [r.acct ?? r.name_key, r.ks.length]).sort();
  assert.deepEqual(await keyed(false), [["zz map cafe", 1], ["zz map old", 1]]);
  assert.deepEqual(await keyed(true), [[cafe, 2]]);
  assert.deepEqual((await loadSources(sql, [cafe])).get(cafe).invoices, ["1 Main St, Austin TX 78701"]);
  await mapOn(q);
  assert.deepEqual((await loadSources(sql, [cafe])).get(cafe).invoices.sort(), ["1 Main St, Austin TX 78701", "12 Old Rd, Austin TX 78701"]);
});

test("Link Check's Map side by side", async () => {
  const { q, sql, cafe } = await fresh();
  const pm = (await q("insert into pm_jobs (customer, status) values ('ZZ Map Old', 'Pending Scheduling') returning id"))[0].id;
  await setId(q, "pm_jobs", pm, cafe);
  await q("insert into network_accounts (customer) values ('ZZ Map Cafe ')");
  const area = (await readByIdFor(sql, "zz-admin")).areas.find((a) => a.area === "map");
  const list = (key) => {
    const l = area.lists.find((x) => x.key === key);
    return [l.present, l.byName, l.byId, l.accounts, l.onlyByName, l.onlyById];
  };
  assert.deepEqual(list("openPms"), [true, 0, 1, 1, 0, 1]);
  assert.deepEqual(list("networkAccounts"), [true, 0, 1, 1, 0, 1]);
  assert.deepEqual(list("openTickets"), [true, 0, 0, 0, 0, 0]);
  assert.ok(area.lists.every((l) => l.present));
});
