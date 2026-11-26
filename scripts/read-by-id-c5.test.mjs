// Reading by id, phase C5 part 1 ("One Record Per Machine Plan", Chuy approved 11/24): the Accounts area (the
// Customers list's counts and the account window's lists) reads an account's records by its id once its switch on Link
// Check is on. A row with no id, or whose id names a removed account, still goes by its name. The ids are set first
// (Set ids), and the switch can't be turned on while any record's id isn't what its name finds. Link Check shows the
// lists by name and by id side by side. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { ofAccount, perAccountJoin, readSwitches, readsById, readByIdFor, setReadByIdFor, sweepReadIdsFor, READ_BY_ID_ADMIN_ONLY } = await import("../src/lib/ops/read-by-id.ts");
const { accountRecordRows, customerRecordsSql } = await import("../src/lib/ops/account-reads.ts");
const { accountHistory } = await import("../src/lib/ops/wo-history-api.ts");
const { listAccountInvoicesFor } = await import("../src/lib/ops/invoice-api.ts");
const { readAccountUnits } = await import("../src/lib/ops/account-equip-import.ts");
const { listRetiredUnits } = await import("../src/lib/ops/account-equip-retire.ts");
const { listAccountPhotosFor } = await import("../src/lib/ops/ticket-photos.ts");

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
async function all() {
  const pg = new PGlite();
  for (const f of files) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  // Live also has names unique in any capitals (seed.server.ts).
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const q = async (t, p) => (await pg.query(t, p)).rows;
  await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-tech', 'zztech', true, false, 'tech')");
  await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Other')");
  const ids = Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
  return { pg, q, sql: { query: q }, cafe: ids["Zz Cafe"], other: ids["Zz Other"] };
}
/** The Accounts switch on, as Link Check leaves it (without the ids check, so drifted rows stay as they are). */
const on = (q) =>
  q("insert into desk_settings (key, value) values ('read_by_id', $1) on conflict (key) do update set value = excluded.value", [
    JSON.stringify({ accounts: { at: "2026-11-25T20:00:00Z", by: "zzadmin" } }),
  ]);

let seq = 0;
const ticket = async (q, name) => (await q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open') returning id", [`SC-ZZ${++seq}`, name]))[0].id;
/** Set only the id, as a statement that writes the id alone does (no record trigger fires). */
const setId = (q, table, id, to) => q(`update ${table} set customer_id = $2 where id = $1`, [id, to]);
const total = (fixes) => fixes.reduce((n, c) => n + c.n, 0);
const byColumn = (fixes) => Object.fromEntries(fixes.filter((c) => c.n).map((c) => [`${c.table}.${c.column}`, c.n]));

/**
 * The Cafe's records, one of each way a row can stand:
 * - same: "Zz Cafe", its id (by name and by id);
 * - caps: "zz cafe", its id (both);
 * - spaces: "Zz Cafe " (the rule finds the Cafe once the spaces are dropped; the lists' name match in capitals doesn't);
 * - drift: "Zz Cafe" with the Other's id (by name on the Cafe, by id on the Other);
 * - noId: "Zz Cafe" with no id (by name, and by its name when read by id).
 */
async function cafeTickets(q, ids) {
  const t = {
    same: await ticket(q, "Zz Cafe"),
    caps: await ticket(q, "zz cafe"),
    spaces: await ticket(q, "Zz Cafe "),
    drift: await ticket(q, "Zz Cafe"),
    noId: await ticket(q, "Zz Cafe"),
  };
  await setId(q, "service_jobs", t.drift, ids.other);
  await setId(q, "service_jobs", t.noId, null);
  return t;
}

test("ofAccount: by name as before, or by id with a row with no id (or a removed account's) going by its name", () => {
  assert.equal(ofAccount({ name: "t.customer", id: "t.customer_id", match: "lower", byId: false, nameParam: "$1", idParam: "$2" }), "lower(t.customer) = lower($1)");
  assert.equal(
    ofAccount({ name: "h.customer", id: "h.customer_id", match: "trim", byId: true, nameParam: "$1", idParam: "$2" }),
    "(h.customer_id = $2::int or (lower(btrim(h.customer)) = lower(btrim($1)) and not exists (select 1 from directory_customers own where own.id = h.customer_id and own.archived = false)))",
  );
  assert.match(perAccountJoin({ table: "deals", alias: "x", where: "true", counts: "count(*) as n", byId: false }), /x\.k = lower\(d\.name\)/);
  assert.match(perAccountJoin({ table: "deals", alias: "x", where: "true", counts: "count(*) as n", byId: true }), /coalesce\(own\.id, nm\.id\)[\s\S]*x\.acct = d\.id/);
});

test("the switch: off by default, admins only, on and off again", async () => {
  const { q, sql } = await all();
  assert.equal(await readsById(sql, "accounts"), false);
  await assert.rejects(setReadByIdFor(sql, "zz-tech", { area: "accounts", on: true }), (e) => e.message === READ_BY_ID_ADMIN_ONLY);
  await assert.rejects(sweepReadIdsFor(sql, "zz-tech"), (e) => e.message === READ_BY_ID_ADMIN_ONLY);
  await assert.rejects(readByIdFor(sql, "zz-tech"), (e) => e.message === READ_BY_ID_ADMIN_ONLY);
  const r = await setReadByIdFor(sql, "zz-admin", { area: "accounts", on: true });
  assert.equal(r.on, true);
  const sw = await readSwitches(sql);
  assert.equal(sw.accounts?.by, "zzadmin");
  assert.ok(Date.parse(sw.accounts.at));
  assert.equal(await readsById(sql, "accounts"), true);
  // Already on (a second click, an old tab): left as it was.
  await q("update desk_settings set value = $1 where key = 'read_by_id'", [JSON.stringify({ accounts: { at: "2026-11-01T00:00:00.000Z", by: "first" } })]);
  await setReadByIdFor(sql, "zz-admin", { area: "accounts", on: true });
  assert.deepEqual((await readSwitches(sql)).accounts, { at: "2026-11-01T00:00:00.000Z", by: "first" });
  await setReadByIdFor(sql, "zz-admin", { area: "accounts", on: false });
  assert.equal(await readsById(sql, "accounts"), false);
  // A setting that isn't JSON, or names no area, reads as off.
  await q("update desk_settings set value = 'nope' where key = 'read_by_id'");
  assert.deepEqual(await readSwitches(sql), {});
  await q("update desk_settings set value = '{\"mars\":{\"at\":\"x\"}}' where key = 'read_by_id'");
  assert.deepEqual(await readSwitches(sql), {});
});

test("a settings read that fails isn't taken for every area off: the switch isn't written over", async () => {
  const { q } = await all();
  await on(q);
  const failing = { query: (t, p) => (/from desk_settings/.test(t) ? Promise.reject(new Error("connection reset")) : q(t, p)) };
  await assert.rejects(setReadByIdFor(failing, "zz-admin", { area: "accounts", on: false }), /connection reset/);
  await assert.rejects(readsById(failing, "accounts"), /connection reset/);
  assert.ok((await readSwitches({ query: q })).accounts);
});

test("Set ids first: the switch waits for every record's id to be what its name finds; follow rows take it, history rows only fill a missing one, and no id is cleared", async () => {
  const { q, sql, cafe, other } = await all();
  const t = await cafeTickets(q, { cafe, other });
  const install = (await q("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id"))[0].id;
  // An invoice a rename left under the old name keeps its id (C3); one with no id that could have one gets it.
  const kept = (await q("insert into invoices (entity_type, entity_id, customer, customer_id) values ('install', $1, 'Zz Other', $2) returning id", [install, cafe]))[0].id;
  const missing = (await q("insert into invoices (entity_type, entity_id, customer) values ('service', $1, 'Zz Cafe') returning id", [t.same]))[0].id;
  await q("update invoices set customer_id = null where id = $1", [missing]);
  // A unit whose name finds no account but whose id does: the sweep doesn't take the id away.
  const unit = (await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Nowhere', 'Zz Brewer', 'Zz Brewer') returning id"))[0].id;
  await setId(q, "account_equipment", unit, cafe);

  const before = await readByIdFor(sql, "zz-admin");
  assert.deepEqual(byColumn(before.toSet), { "service_jobs.customer_id": 2, "invoices.customer_id": 1 });
  await assert.rejects(setReadByIdFor(sql, "zz-admin", { area: "accounts", on: true }), /Set the ids first: 3 records/);
  assert.equal(await readsById(sql, "accounts"), false);

  const fixed = await sweepReadIdsFor(sql, "zz-admin");
  assert.deepEqual(byColumn(fixed), { "service_jobs.customer_id": 2, "invoices.customer_id": 1 });
  const ids = Object.fromEntries((await q("select id, customer_id from service_jobs")).map((x) => [x.id, x.customer_id]));
  assert.equal(ids[t.drift], cafe);
  assert.equal(ids[t.noId], cafe);
  assert.equal(ids[t.spaces], cafe);
  const inv = Object.fromEntries((await q("select id, customer_id from invoices")).map((x) => [x.id, x.customer_id]));
  assert.equal(inv[kept], cafe, "a kept id stays");
  assert.equal(inv[missing], cafe);
  assert.equal((await q("select customer_id from account_equipment where id = $1", [unit]))[0].customer_id, cafe, "an id is never cleared");

  assert.equal(total((await readByIdFor(sql, "zz-admin")).toSet), 0);
  assert.equal(total(await sweepReadIdsFor(sql, "zz-admin")), 0, "a second sweep has nothing to do");
  const r = await setReadByIdFor(sql, "zz-admin", { area: "accounts", on: true });
  assert.equal(r.on, true);
});

test("the account window's tickets, PMs, installs, deals and recipes: by name, then by id", async () => {
  const { q, sql, cafe, other } = await all();
  const t = await cafeTickets(q, { cafe, other });
  const pm = (await q("insert into pm_jobs (customer) values ('Zz Cafe ') returning id"))[0].id;
  const deal = (await q("insert into deals (customer, customer_id) values ('Zz Old Cafe', $1) returning id", [cafe]))[0].id;
  const byName = await accountRecordRows(sql, { id: cafe, name: "Zz Cafe" }, false);
  assert.deepEqual(byName.jobs.map((j) => j.id).sort(), [t.same, t.caps, t.drift, t.noId].sort());
  assert.deepEqual(byName.pms, []);
  assert.deepEqual(byName.deals, []);
  const byId = await accountRecordRows(sql, { id: cafe, name: "Zz Cafe" }, true);
  assert.deepEqual(byId.jobs.map((j) => j.id).sort(), [t.same, t.caps, t.spaces, t.noId].sort());
  assert.deepEqual(byId.pms.map((p) => p.id), [pm]);
  assert.deepEqual(byId.deals.map((d) => d.id), [deal]);
  const otherById = await accountRecordRows(sql, { id: other, name: "Zz Other" }, true);
  assert.deepEqual(otherById.jobs.map((j) => j.id), [t.drift]);
});

test("the Customers list's counts: by name, then by id", async () => {
  const { q, sql, cafe, other } = await all();
  await cafeTickets(q, { cafe, other });
  await q("insert into service_jobs (kind, call_id, customer, status, done) values ('tlc', 'SC-ZZT', 'Zz Cafe ', 'Completed', true)");
  await q("insert into recipes (name, equipment_model, customer) values ('r', 'Zz Grinder', 'Zz Cafe ')");
  const counts = async (byId) => Object.fromEntries((await q(customerRecordsSql(byId))).map((r) => [r.name, r]));
  const a = await counts(false);
  assert.equal(a["Zz Cafe"].calls, 4);
  assert.equal(a["Zz Cafe"].pending_calls, 4);
  assert.equal(a["Zz Cafe"].tlcs, 0);
  assert.equal(a["Zz Cafe"].recipes, 0);
  assert.equal(a["Zz Other"].calls, 0);
  const b = await counts(true);
  assert.equal(b["Zz Cafe"].calls, 4, "same, spaces, caps and the one with no id");
  assert.equal(b["Zz Cafe"].tlcs, 1);
  assert.equal(b["Zz Cafe"].pending_tlcs, 0);
  assert.equal(b["Zz Cafe"].recipes, 1);
  assert.equal(b["Zz Other"].calls, 1, "the row whose id names the Other");
});

test("work order history, invoices, equipment, retired equipment and photos read by id with the account's id and the switch on", async () => {
  const { q, sql, cafe, other } = await all();
  const run = (await q("insert into wo_history_runs (filename) values ('zz.csv') returning id"))[0].id;
  const wo = async (ref, name, id) => {
    const row = (await q("insert into wo_history (run_id, history_ref, customer) values ($1, $2, $3) returning id", [run, ref, name]))[0].id;
    if (id !== undefined) await setId(q, "wo_history", row, id);
    return row;
  };
  const woSame = await wo("ZZ-1", "Zz Cafe");
  const woOld = await wo("ZZ-2", "Zz Old Cafe", cafe);
  const woDrift = await wo("ZZ-3", "Zz Cafe", other);
  const idsOf = (rows) => rows.map((r) => r.id).sort();

  // An install under the name, and one a rename left under the old name; each with a photo. The old one has an
  // approved invoice under the old name too.
  const photo = (installId) => q("insert into ticket_photos (install_id, data, thumb, bytes, width, height, added_by) values ($1, '\\x00', '\\x00', 1, 1, 1, 'zz-admin')", [installId]);
  const install = (await q("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id"))[0].id;
  const oldInstall = (await q("insert into installs (customer, customer_id, equipment) values ('Zz Old Cafe', $1, 'G') returning id", [cafe]))[0].id;
  await photo(install);
  await photo(oldInstall);
  await q("insert into invoices (entity_type, entity_id, customer, customer_id, total, approved_at) values ('install', $1, 'Zz Old Cafe', $2, 10, now())", [oldInstall, cafe]);
  // A ticket a rename left under the old name, with charges not approved yet (the Invoices tab's other half).
  const charged = (await q("insert into service_jobs (kind, call_id, customer, customer_id, status) values ('service', 'SC-ZZC', 'Zz Old Cafe', $1, 'Open') returning id", [cafe]))[0].id;
  await q("insert into ticket_charges (job_id, item, description, qty, rate, kind) values ($1, 'LABOR', 'Labor', 1, 95, 'labor')", [charged]);
  // Equipment: one unit under the name, one a rename left under the old name; a retired copy likewise.
  const unit = (await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Cafe', 'Zz Brewer', 'Zz Brewer') returning id"))[0].id;
  const oldUnit = (await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Old Cafe', 'Zz Grinder', 'Zz Grinder') returning id"))[0].id;
  await setId(q, "account_equipment", oldUnit, cafe);
  const retired = (await q("insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, unit) values (99001, 'Zz Old Cafe', 'Zz Brewer', 'Zz Brewer', '{}') returning id"))[0].id;
  await setId(q, "account_equipment_retired", retired, cafe);
  const photoInstalls = async () => (await listAccountPhotosFor(sql, "zz-admin", { customerId: cafe })).groups.map((g) => g.installId).sort();

  // Off: by name, whether or not the id is sent.
  for (const id of [null, cafe]) {
    assert.deepEqual(idsOf(await accountHistory(sql, "Zz Cafe", { customerId: id })), [woSame, woDrift].sort());
    assert.deepEqual((await listAccountInvoicesFor(sql, "Zz Cafe", "zz-admin", id)).map((i) => i.id), []);
    assert.deepEqual((await readAccountUnits(sql, "Zz Cafe", id)).map((u) => u.id), [unit]);
    assert.deepEqual((await listRetiredUnits(sql, "Zz Cafe", id)).map((r) => r.id), []);
  }
  assert.deepEqual(await photoInstalls(), [install]);

  await on(q);
  // On, without the account's id (the ticket window): still by name.
  assert.deepEqual(idsOf(await accountHistory(sql, "Zz Cafe")), [woSame, woDrift].sort());
  assert.deepEqual((await readAccountUnits(sql, "Zz Cafe")).map((u) => u.id), [unit]);
  // On, with it (the account window): by id.
  assert.deepEqual(idsOf(await accountHistory(sql, "Zz Cafe", { customerId: cafe })), [woSame, woOld].sort());
  assert.deepEqual(
    (await listAccountInvoicesFor(sql, "Zz Cafe", "zz-admin", cafe)).map((i) => [i.type, i.id]).sort(),
    [
      ["install", oldInstall],
      ["service", charged],
    ],
  );
  assert.deepEqual((await readAccountUnits(sql, "Zz Cafe", cafe)).map((u) => u.id).sort(), [unit, oldUnit].sort());
  assert.deepEqual((await listRetiredUnits(sql, "Zz Cafe", cafe)).map((r) => r.id), [retired]);
  assert.deepEqual(await photoInstalls(), [install, oldInstall].sort());
});

test("a record whose id names a removed account still goes by its name when read by id", async () => {
  const { q, sql, cafe } = await all();
  // "Zz Gone" had an approved invoice and a ticket; the account was removed and a new one took the name.
  const gone = (await q("insert into directory_customers (name) values ('Zz Gone') returning id"))[0].id;
  const tk = await ticket(q, "Zz Gone");
  const inv = (await q("insert into invoices (entity_type, entity_id, customer, total, approved_at) values ('service', $1, 'Zz Gone', 5, now()) returning id", [tk]))[0].id;
  await q("update directory_customers set archived = true, name = 'Zz Gone · removed' where id = $1", [gone]);
  const fresh = (await q("insert into directory_customers (name) values ('Zz Gone') returning id"))[0].id;
  // The invoice kept the removed account's id (C3); the ticket follows the name to the new account.
  assert.equal((await q("select customer_id from invoices where id = $1", [inv]))[0].customer_id, gone);
  assert.equal((await q("select customer_id from service_jobs where id = $1", [tk]))[0].customer_id, fresh);
  await on(q);
  assert.deepEqual((await listAccountInvoicesFor(sql, "Zz Gone", "zz-admin", fresh)).map((i) => i.id), [tk]);
  const area = (await readByIdFor(sql, "zz-admin")).areas[0];
  const invoices = area.lists.find((l) => l.key === "invoices");
  assert.deepEqual([invoices.byName, invoices.byId, invoices.accounts], [1, 1, 0]);
  void cafe;
});

test("Link Check's side by side: by name and by id for each list, and the accounts that differ", async () => {
  const { q, sql, cafe, other } = await all();
  await cafeTickets(q, { cafe, other });
  // A ticket merged into another (a duplicate), with charges and an invoice: the Invoices tab leaves both out.
  const dupe = await ticket(q, "Zz Cafe");
  await q("update service_jobs set duplicate_of = (select min(id) from service_jobs) where id = $1", [dupe]);
  await q("insert into ticket_charges (job_id, item, description, qty, rate, kind) values ($1, 'LABOR', 'Labor', 1, 95, 'labor')", [dupe]);
  await q("insert into invoices (entity_type, entity_id, customer, total, approved_at) values ('service', $1, 'Zz Cafe', 95, now())", [dupe]);
  const r = await readByIdFor(sql, "zz-admin");
  const area = r.areas.find((a) => a.area === "accounts");
  assert.equal(area.on, null);
  const tickets = area.lists.find((l) => l.key === "tickets");
  // By name: same, caps, drift, noId, dupe on the Cafe. By id: same, caps, spaces, noId, dupe on the Cafe and drift on the Other.
  assert.deepEqual(
    { byName: tickets.byName, byId: tickets.byId, accounts: tickets.accounts, onlyByName: tickets.onlyByName, onlyById: tickets.onlyById },
    { byName: 5, byId: 6, accounts: 2, onlyByName: 1, onlyById: 2 },
  );
  assert.deepEqual(
    tickets.samples.map((s) => [s.name, s.byName, s.byId]).sort(),
    [
      ["Zz Cafe", 5, 5],
      ["Zz Other", 0, 1],
    ],
  );
  for (const key of ["invoices", "chargedTickets"]) {
    const l = area.lists.find((x) => x.key === key);
    assert.deepEqual([l.byName, l.byId], [0, 0], `${key} leaves the merged ticket out, as the tab does`);
  }
  const deals = area.lists.find((l) => l.key === "deals");
  assert.deepEqual([deals.present, deals.byName, deals.byId, deals.accounts], [true, 0, 0, 0]);
  assert.ok(area.lists.every((l) => l.present));
  // After Set ids, only the row with spaces at the ends differs (its name doesn't find the Cafe in capitals).
  await sweepReadIdsFor(sql, "zz-admin");
  await setReadByIdFor(sql, "zz-admin", { area: "accounts", on: true });
  const after = (await readByIdFor(sql, "zz-admin")).areas[0];
  assert.ok(after.on);
  const t2 = after.lists.find((l) => l.key === "tickets");
  assert.deepEqual([t2.byName, t2.byId, t2.onlyByName, t2.onlyById, t2.accounts], [5, 6, 0, 1, 1]);
});
