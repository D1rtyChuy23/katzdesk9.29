// Ticket-to-machine links (Chuy, 11/21): a service or TLC ticket can name any number of the account's units, picked on
// its Equipment tab; each unit's window lists its Service History. Optional: nothing is blocked without one. A link
// survives Remove and Put back, follows a unit merge, and a ticket moved to another account drops links that aren't
// on it. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const T = await import("../src/lib/ops/ticket-units-api.ts");
const E = await import("../src/lib/ops/account-equip-import.ts");
const RET = await import("../src/lib/ops/account-equip-retire.ts");
const A = await import("../src/lib/ops/api.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
let last = null;
async function fresh() {
  if (last) await last.close().catch(() => {});
  const pg = new PGlite();
  last = pg;
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-desk', 'dana', true, false, 'service'), ('u-wh', 'wes', true, false, 'warehouse')`,
  );
  await pg.query("insert into directory_customers (name) values ('Alpha Cafe'), ('Beta Bakery')");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
}
const idOf = async (sql, text, params) => Number((await sql.query(text, params))[0].id);
const unit = (sql, customer, model, serial) =>
  idOf(sql, "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, $3, lower($3)) returning id", [customer, model, serial]);
const ticket = (sql, customer, kind = "service") =>
  idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received, equipment) values ($1, 'SC-TU-' || floor(random()*1e9)::text, $2, 'Open', '2026-11-02', 'brewer') returning id", [kind, customer]);

test("migration 0135 only adds the ticket_units table and its index", () => {
  const m = readFileSync(new URL("0135_ticket_units.sql", MIGRATIONS), "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(m, /^\s*(drop|delete|update|truncate|alter)\b/im, "no statement changes or removes anything");
  assert.match(m, /create table if not exists ticket_units/);
  assert.match(m, /primary key \(job_id, account_equipment_id\)/);
});

test("a ticket names several of its account's units; the account's other units are offered; each unit lists the ticket", async () => {
  const sql = await fresh();
  const brewer = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const grinder = await unit(sql, "Alpha Cafe", "Zz Grinder", "SN-2");
  const other = await unit(sql, "Beta Bakery", "Zz Brewer", "SN-9");
  const job = await ticket(sql, "Alpha Cafe");
  let v = await T.ticketUnitsFor(sql, job, "u-desk");
  assert.deepEqual([v.linked, v.options.map((o) => o.id), v.canEdit], [[], [brewer, grinder], true]);
  v = await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [grinder, brewer] }, "u-desk");
  assert.deepEqual(v.linked.map((u) => u.id), [brewer, grinder]);
  const h = await T.unitServiceHistoryFor(sql, brewer, "u-desk");
  assert.deepEqual(h.map((x) => x.jobId), [job]);
  await assert.rejects(T.setTicketUnitsFor(sql, { jobId: job, unitIds: [other] }, "u-desk"), /isn't on Alpha Cafe/);
  v = await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [grinder] }, "u-desk");
  assert.deepEqual(v.linked.map((u) => u.id), [grinder]);
  assert.deepEqual(await T.unitServiceHistoryFor(sql, brewer, "u-desk"), []);
  // The Merge dialog counts a linked ticket even when its text doesn't name the serial.
  assert.equal((await E.unitLinkCounts(sql, [grinder]))[grinder].tickets, 1);
});

test("Walk-In tickets and Warehouse can't link; a TLC ticket can", async () => {
  const sql = await fresh();
  const u = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const walk = await ticket(sql, "Walk-In");
  await assert.rejects(T.setTicketUnitsFor(sql, { jobId: walk, unitIds: [u] }, "u-owner"), /Walk-In/);
  const job = await ticket(sql, "Alpha Cafe");
  await assert.rejects(T.setTicketUnitsFor(sql, { jobId: job, unitIds: [u] }, "u-wh"), /Warehouse/);
  assert.equal((await T.ticketUnitsFor(sql, job, "u-wh")).canEdit, false);
  const tlc = await ticket(sql, "Alpha Cafe", "tlc");
  assert.equal((await T.setTicketUnitsFor(sql, { jobId: tlc, unitIds: [u] }, "u-owner")).linked.length, 1);
});

test("moving a ticket to another account drops links to units that aren't on it", async () => {
  const sql = await fresh();
  const u = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const job = await ticket(sql, "Alpha Cafe");
  await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [u] }, "u-owner");
  await A.updateJobFor(sql, { id: job, customer: "Beta Bakery" }, "u-owner");
  assert.deepEqual((await T.ticketUnitsFor(sql, job, "u-owner")).linked, []);
});

test("a removed unit keeps its tickets for Put back; a merged unit's tickets follow the kept one", async () => {
  const sql = await fresh();
  const u = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const job = await ticket(sql, "Alpha Cafe");
  await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [u] }, "u-owner");
  await E.removeEquipmentUnit(sql, u, { userId: "u-owner", name: "chuy" });
  assert.equal((await sql.query("select count(*)::int as n from ticket_units"))[0].n, 0);
  const retired = (await sql.query("select id from account_equipment_retired where unit_id = $1", [u]))[0].id;
  await RET.restoreRetiredUnit(sql, Number(retired));
  assert.deepEqual((await T.unitServiceHistoryFor(sql, u, "u-owner")).map((x) => x.jobId), [job]);
  const keep = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const job2 = await ticket(sql, "Alpha Cafe");
  await T.setTicketUnitsFor(sql, { jobId: job2, unitIds: [u, keep] }, "u-owner");
  await E.mergeEquipmentUnits(sql, keep, u);
  assert.deepEqual((await sql.query("select job_id, account_equipment_id from ticket_units order by job_id")).map((r) => [r.job_id, r.account_equipment_id]), [
    [job, keep],
    [job2, keep],
  ]);
});

test("the ticket's Equipment tab has the picker; the unit window has Service History", () => {
  assert.match(src("src/components/desk/job-sheet.tsx"), /<TicketUnitsPicker jobId=\{j\.id\}/);
  assert.match(src("src/components/desk/account-unit-form.tsx"), /<UnitServiceHistory unitId=\{unit\.id\} \/>/);
});

test("review: a machine that moved to another account keeps the ticket; the picker lists it so it can be unticked, and other saves aren't blocked", async () => {
  const sql = await fresh();
  const a = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const b = await unit(sql, "Alpha Cafe", "Zz Grinder", "SN-2");
  const job = await ticket(sql, "Alpha Cafe");
  await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [a] }, "u-owner");
  await sql.query("update account_equipment set customer = 'Beta Bakery' where id = $1", [a]);
  let v = await T.ticketUnitsFor(sql, job, "u-owner");
  assert.deepEqual(v.linked.map((u) => [u.id, u.elsewhere]), [[a, "Beta Bakery"]]);
  v = await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [a, b] }, "u-owner");
  assert.deepEqual(v.linked.map((u) => u.id).sort(), [a, b].sort(), "keeping the moved one while adding another is fine");
  assert.deepEqual((await T.unitServiceHistoryFor(sql, a, "u-owner")).map((x) => x.jobId), [job], "its history is the machine's");
  await A.updateJobFor(sql, { id: job, customer: "Beta Bakery" }, "u-owner");
  assert.deepEqual((await T.ticketUnitsFor(sql, job, "u-owner")).linked.map((u) => u.id), [a], "the move drops Alpha's grinder only");
});

test("review: merging a ticket into another moves its machines to the keeper", async () => {
  const sql = await fresh();
  const u1 = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const u2 = await unit(sql, "Alpha Cafe", "Zz Grinder", "SN-2");
  const W = await import("../src/lib/ops/wo-duplicates.ts");
  const keeper = await ticket(sql, "Alpha Cafe");
  const extra = await ticket(sql, "Alpha Cafe");
  await T.setTicketUnitsFor(sql, { jobId: keeper, unitIds: [u1] }, "u-owner");
  await T.setTicketUnitsFor(sql, { jobId: extra, unitIds: [u1, u2] }, "u-owner");
  const r = await W.mergeServiceJobs(sql, keeper, extra, "chuy");
  assert.ok(!r?.refused, JSON.stringify(r));
  assert.deepEqual((await sql.query("select job_id, account_equipment_id from ticket_units order by account_equipment_id")).map((x) => [x.job_id, x.account_equipment_id]), [
    [keeper, u1],
    [keeper, u2],
  ]);
  await assert.rejects(T.setTicketUnitsFor(sql, { jobId: extra, unitIds: [u1] }, "u-owner"), /merged into another ticket/);
  assert.equal((await T.ticketUnitsFor(sql, extra, "u-owner")).canEdit, false);
});

test("review: Put back doesn't re-link a ticket that moved off the account meanwhile", async () => {
  const sql = await fresh();
  const u = await unit(sql, "Alpha Cafe", "Zz Brewer", "SN-1");
  const job = await ticket(sql, "Alpha Cafe");
  await T.setTicketUnitsFor(sql, { jobId: job, unitIds: [u] }, "u-owner");
  await E.removeEquipmentUnit(sql, u, { userId: "u-owner", name: "chuy" });
  await sql.query("update service_jobs set customer = 'Beta Bakery' where id = $1", [job]);
  const retired = (await sql.query("select id from account_equipment_retired where unit_id = $1", [u]))[0].id;
  assert.equal((await RET.listRetiredUnits(sql, "Alpha Cafe"))[0].records, 1, "the retired list counts the ticket link");
  await RET.restoreRetiredUnit(sql, Number(retired));
  assert.equal((await sql.query("select count(*)::int as n from ticket_units"))[0].n, 0);
});

test("review: the install prune keeps a unit a ticket names; the Corrigo import drops links off the old account", () => {
  assert.match(src("src/lib/ops/inspection-api.ts"), /and not exists \(select 1 from ticket_units t where t\.account_equipment_id = a\.id\)/);
  assert.match(src("src/lib/ops/corrigo-import.ts"), /if \(saved\) await dropOffAccountTicketUnits\(sql, jobId, cur\[0\]\.customer\);/);
  assert.match(src("src/lib/ops/api.ts"), /await dropOffAccountTicketUnits\(sql, data\.id, cur\[0\]\.customer\);/);
});
