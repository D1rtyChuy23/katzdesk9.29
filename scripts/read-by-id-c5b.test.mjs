// Reading by id, phase C5 part 2 ("One Record Per Machine Plan", Chuy approved 11/24): the Tickets area. The ticket
// window opens the ticket's own account (not the one its name finds), and reads that account's equipment, retired
// equipment, Out Of Network providers and Eversys modules by its id, once the Tickets switch on Link Check is on. The
// account window's providers follow the Accounts switch. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { readSwitches, readsById, readByIdFor, setReadByIdFor, READ_AREAS } = await import("../src/lib/ops/read-by-id.ts");
const { readAccountUnits } = await import("../src/lib/ops/account-equip-import.ts");
const { listRetiredUnits } = await import("../src/lib/ops/account-equip-retire.ts");
const { customerProvidersFor } = await import("../src/lib/ops/network-api.ts");
const { modulesOnAccount } = await import("../src/lib/ops/eversys.ts");
const { mapJob } = await import("../src/lib/ops/api.ts");

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
async function all() {
  const pg = new PGlite();
  for (const f of files) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const q = async (t, p) => (await pg.query(t, p)).rows;
  await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Other')");
  const ids = Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
  return { pg, q, sql: { query: q }, cafe: ids["Zz Cafe"], other: ids["Zz Other"] };
}
const turn = (q, areas) =>
  q("insert into desk_settings (key, value) values ('read_by_id', $1) on conflict (key) do update set value = excluded.value", [
    JSON.stringify(Object.fromEntries(areas.map((a) => [a, { at: "2026-11-25T22:00:00Z", by: "zzadmin" }]))),
  ]);
const setId = (q, table, id, col, to) => q(`update ${table} set ${col} = $2 where id = $1`, [id, to]);
let seq = 0;

test("Tickets is its own area: its switch is separate from Accounts'", async () => {
  const { q, sql } = await all();
  assert.deepEqual(READ_AREAS.map((a) => a.area).slice(0, 2), ["accounts", "tickets"]);
  await setReadByIdFor(sql, "zz-admin", { area: "tickets", on: true });
  assert.equal(await readsById(sql, "tickets"), true);
  assert.equal(await readsById(sql, "accounts"), false);
  assert.deepEqual(Object.keys(await readSwitches(sql)), ["tickets"]);
  void q;
});

test("the ticket window's equipment and retired lists follow the Tickets switch; the account window's, the Accounts one", async () => {
  const { q, sql, cafe } = await all();
  const unit = (await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Cafe', 'Zz Brewer', 'Zz Brewer') returning id"))[0].id;
  const oldUnit = (await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Old Cafe', 'Zz Grinder', 'Zz Grinder') returning id"))[0].id;
  await setId(q, "account_equipment", oldUnit, "customer_id", cafe);
  const retired = (await q("insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, unit) values (99001, 'Zz Old Cafe', 'Zz Brewer', 'Zz Brewer', '{}') returning id"))[0].id;
  await setId(q, "account_equipment_retired", retired, "customer_id", cafe);
  const units = async (area) => (await readAccountUnits(sql, "Zz Cafe", cafe, area)).map((u) => u.id).sort();
  const gone = async (area) => (await listRetiredUnits(sql, "Zz Cafe", cafe, area)).map((r) => r.id);

  await turn(q, ["accounts"]);
  assert.deepEqual(await units("accounts"), [unit, oldUnit].sort());
  assert.deepEqual(await units("tickets"), [unit]);
  assert.deepEqual(await gone("accounts"), [retired]);
  assert.deepEqual(await gone("tickets"), []);
  await turn(q, ["tickets"]);
  assert.deepEqual(await units("accounts"), [unit]);
  assert.deepEqual(await units("tickets"), [unit, oldUnit].sort());
  assert.deepEqual(await gone("tickets"), [retired]);
  // No area named: the account window's, as part 1 left it.
  assert.deepEqual((await readAccountUnits(sql, "Zz Cafe", cafe)).map((u) => u.id), [unit]);
});

test("Out Of Network providers: by name, or by the account's id with the window's switch on", async () => {
  const { q, sql, cafe } = await all();
  const provider = async (name) => (await q("insert into network_providers (name) values ($1) returning id", [name]))[0].id;
  const pA = await provider("Zz Repair A");
  const pB = await provider("Zz Repair B");
  const pGone = await provider("Zz Repair Gone");
  await q("update network_providers set archived = true where id = $1", [pGone]);
  await q("insert into customer_providers (customer, provider_id, role) values ('Zz Cafe', $1, 'primary')", [pA]);
  // Saved with a space at the end: the rule links it to the Cafe; the name match in capitals doesn't.
  await q("insert into customer_providers (customer, provider_id, role) values ('Zz Cafe ', $1, 'secondary')", [pB]);
  await q("insert into customer_providers (customer, provider_id, role) values ('Zz Cafe', $1, 'additional')", [pGone]);
  const names = async (customerId, area) => (await customerProvidersFor(sql, "Zz Cafe", customerId, area)).map((l) => l.provider.name);
  assert.deepEqual(await names(cafe, "accounts"), ["Zz Repair A"]);
  await turn(q, ["accounts"]);
  assert.deepEqual(await names(cafe, "accounts"), ["Zz Repair A", "Zz Repair B"]);
  assert.deepEqual(await names(null, "accounts"), ["Zz Repair A"], "no id sent: by name");
  assert.deepEqual(await names(cafe, "tickets"), ["Zz Repair A"]);
  await turn(q, ["tickets"]);
  assert.deepEqual(await names(cafe, "tickets"), ["Zz Repair A", "Zz Repair B"]);
  assert.deepEqual(await customerProvidersFor(sql, "  ", cafe, "tickets"), []);
});

test("the ticket window's Eversys modules: by the account's id once Tickets reads by id; a module with no id by its name or place", () => {
  const mods = [
    { id: 1, status: "Assigned", assignedCustomer: "Zz Cafe", assignedCustomerId: 10, location: null },
    { id: 2, status: "Assigned", assignedCustomer: "Zz Old Cafe", assignedCustomerId: 10, location: null },
    { id: 3, status: "Assigned", assignedCustomer: "Zz Cafe", assignedCustomerId: 20, location: null },
    { id: 4, status: "Installed at Account", assignedCustomer: null, assignedCustomerId: null, location: "zz cafe" },
    { id: 5, status: "Assigned", assignedCustomer: "Zz Cafe", assignedCustomerId: null, location: null },
  ];
  assert.deepEqual(modulesOnAccount(mods, " Zz Cafe ", null).map((m) => m.id), [1, 3, 4, 5]);
  assert.deepEqual(modulesOnAccount(mods, "Zz Cafe", 10).map((m) => m.id), [1, 2, 4, 5]);
});

test("a ticket carries its account's id", () => {
  assert.equal(mapJob({ id: 1, kind: "service", customer: "Zz Cafe", customer_id: 7, updated_at: "x" }, "2026-11-25").customerId, 7);
  assert.equal(mapJob({ id: 2, kind: "service", customer: "Zz Cafe", customer_id: null, updated_at: "x" }, "2026-11-25").customerId, null);
});

test("Link Check's Tickets side by side: the account each ticket opens (Inactive ones too by id), equipment, providers and modules", async () => {
  const { q, sql, cafe } = await all();
  await q("insert into directory_customers (name, inactive) values ('Zz Sleepy', true)");
  const ticket = (name) => q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open')", [`SC-ZZ${++seq}`, name]);
  await ticket("Zz Cafe");
  await ticket("Zz Cafe ");
  await ticket("Zz Sleepy");
  const pA = (await q("insert into network_providers (name) values ('Zz Repair A') returning id"))[0].id;
  await q("insert into customer_providers (customer, provider_id, role) values ('Zz Cafe ', $1, 'primary')", [pA]);
  await q("insert into modules (module_id, assigned_customer) values ('ZZM-1', 'Zz Old Cafe')");
  await q("update modules set assigned_customer_id = $1 where module_id = 'ZZM-1'", [cafe]);
  const area = (await readByIdFor(sql, "zz-admin")).areas.find((a) => a.area === "tickets");
  const list = (key) => {
    const l = area.lists.find((x) => x.key === key);
    return [l.present, l.byName, l.byId, l.accounts, l.onlyByName, l.onlyById];
  };
  // By name the window finds the Cafe for "Zz Cafe" and "Zz Cafe " (spaces dropped), and nothing for an Inactive
  // account (the picker leaves it out). By id, all three open their own account.
  assert.deepEqual(list("ticketAccount"), [true, 2, 3, 1, 0, 1]);
  assert.deepEqual(list("providers"), [true, 0, 1, 1, 0, 1]);
  assert.deepEqual(list("modules"), [true, 0, 1, 1, 0, 1]);
  assert.deepEqual(list("equipment"), [true, 0, 0, 0, 0, 0]);
  const sleepy = area.lists.find((x) => x.key === "ticketAccount").samples;
  assert.deepEqual(sleepy.map((s) => [s.name, s.byName, s.byId]), [["Zz Sleepy", 0, 1]]);
  // The Accounts area lists the providers too.
  const acc = (await readByIdFor(sql, "zz-admin")).areas.find((a) => a.area === "accounts");
  assert.ok(acc.lists.some((l) => l.key === "providers" && l.onlyById === 1));
});
