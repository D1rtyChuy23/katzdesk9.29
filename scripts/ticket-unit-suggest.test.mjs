// Suggested machines for older tickets (Chuy, 11/21: "Suggest, you confirm"): where a ticket's equipment, issue or work
// done names one of its account's units by serial, Equipment Mismatches lists the pair. Nothing links until someone
// confirms; "Not this one" hides a pair for good. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const T = await import("../src/lib/ops/ticket-units-api.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
let last = null;
let calls = 0;
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
  idOf(sql, "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, $3, lower(regexp_replace($3, '[#[:space:]]', '', 'g'))) returning id", [customer, model, serial]);
const ticket = (sql, customer, text, o = {}) =>
  idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received, equipment, work_done) values ($1, $2, $3, 'Completed', $4, $5, $6) returning id", [
    o.kind ?? "service",
    `SC-SG-${++calls}`,
    customer,
    o.received ?? "2026-05-01",
    text,
    o.workDone ?? null,
  ]);

test("migration 0136 only adds the dismissals table", () => {
  const m = readFileSync(new URL("0136_ticket_unit_dismissals.sql", MIGRATIONS), "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(m, /^\s*(drop|delete|update|truncate|alter)\b/im);
  assert.match(m, /create table if not exists ticket_unit_dismissals/);
});

test("a ticket whose text names a unit's serial on its own account is suggested; nothing links by itself", async () => {
  const sql = await fresh();
  const brewer = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB 12345");
  await unit(sql, "Beta Bakery", "Zz Brewer", "ZZB12399");
  const job = await ticket(sql, "Alpha Cafe", "Brewer s/n zzb12345 leaking");
  await ticket(sql, "Alpha Cafe", "grinder jam");
  await ticket(sql, "Beta Bakery", "unit ZZB12345");
  const s = await T.ticketUnitSuggestionsFor(sql, {}, "u-desk");
  assert.deepEqual(s.rows.map((r) => [r.jobId, r.unit.id, r.others]), [[job, brewer, 0]]);
  assert.equal(s.total, 1);
  assert.equal((await sql.query("select count(*)::int as n from ticket_units"))[0].n, 0);
});

test("work done counts; a serial under 5 characters, a Walk-In, a merged-away ticket or an existing link isn't suggested", async () => {
  const sql = await fresh();
  const a = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  const short = await unit(sql, "Alpha Cafe", "Zz Grinder", "G12");
  const viaWork = await ticket(sql, "Alpha Cafe", "brewer", { workDone: "Replaced valve on #ZZB12345" });
  await ticket(sql, "Alpha Cafe", "grinder G12");
  await ticket(sql, "Walk-In", "ZZB12345");
  const keeper = await ticket(sql, "Alpha Cafe", "no serial here");
  const merged = await ticket(sql, "Alpha Cafe", "ZZB12345");
  await sql.query("update service_jobs set duplicate_of = $1 where id = $2", [keeper, merged]);
  const linked = await ticket(sql, "Alpha Cafe", "ZZB12345 again");
  await T.setTicketUnitsFor(sql, { jobId: linked, unitIds: [a] }, "u-owner");
  const s = await T.ticketUnitSuggestionsFor(sql, {}, "u-desk");
  assert.deepEqual(s.rows.map((r) => r.jobId), [viaWork]);
  assert.ok(!s.rows.some((r) => r.unit.id === short));
});

test("a ticket naming two units shows both, each telling how many others it names; newest first", async () => {
  const sql = await fresh();
  const b = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  const g = await unit(sql, "Alpha Cafe", "Zz Grinder", "ZZG67890");
  const older = await ticket(sql, "Alpha Cafe", "ZZB12345", { received: "2026-01-02" });
  const both = await ticket(sql, "Alpha Cafe", "ZZB12345 and ZZG67890", { received: "2026-06-02" });
  const s = await T.ticketUnitSuggestionsFor(sql, {}, "u-desk");
  assert.deepEqual(s.rows.map((r) => [r.jobId, r.unit.id, r.others]), [
    [both, b, 1],
    [both, g, 1],
    [older, b, 0],
  ]);
});

test("Confirm links the pairs; Not this one hides a pair for good; both check the account again; Warehouse can't", async () => {
  const sql = await fresh();
  const b = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  const g = await unit(sql, "Alpha Cafe", "Zz Grinder", "ZZG67890");
  const job = await ticket(sql, "Alpha Cafe", "ZZB12345 ZZG67890");
  await assert.rejects(T.confirmTicketUnitSuggestionsFor(sql, { pairs: [{ jobId: job, unitId: b }] }, "u-wh"), /Warehouse/);
  let r = await T.confirmTicketUnitSuggestionsFor(sql, { pairs: [{ jobId: job, unitId: b }] }, "u-desk");
  assert.deepEqual([r.linked, r.skipped], [1, 0]);
  assert.deepEqual((await T.ticketUnitsFor(sql, job, "u-desk")).linked.map((u) => u.id), [b]);
  await T.dismissTicketUnitSuggestionsFor(sql, { pairs: [{ jobId: job, unitId: g }] }, "u-desk");
  assert.deepEqual((await T.ticketUnitSuggestionsFor(sql, {}, "u-desk")).rows, []);
  // The unit moved to another account since the list was read: skipped, not linked.
  const job2 = await ticket(sql, "Alpha Cafe", "ZZG67890");
  await sql.query("update account_equipment set customer = 'Beta Bakery' where id = $1", [g]);
  r = await T.confirmTicketUnitSuggestionsFor(sql, { pairs: [{ jobId: job2, unitId: g }] }, "u-desk");
  assert.deepEqual([r.linked, r.skipped], [0, 1]);
});

test("the list can be narrowed to one account and pages", async () => {
  const sql = await fresh();
  await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  await unit(sql, "Beta Bakery", "Zz Brewer", "ZZB99999");
  for (let i = 0; i < 3; i++) await ticket(sql, "Alpha Cafe", "ZZB12345");
  await ticket(sql, "Beta Bakery", "ZZB99999");
  const alpha = await T.ticketUnitSuggestionsFor(sql, { customer: "alpha cafe", limit: 2 }, "u-desk");
  assert.ok(alpha.rows.every((r) => r.customer === "Alpha Cafe"));
  assert.deepEqual([alpha.rows.length, alpha.total], [2, 3]);
  const next = await T.ticketUnitSuggestionsFor(sql, { customer: "Alpha Cafe", limit: 2, offset: 2 }, "u-desk");
  assert.equal(next.rows.length, 1);
});

test("Equipment Mismatches has the section", () => {
  assert.match(src("src/routes/_app/unit-mismatches.tsx"), /<TicketUnitSuggestions \/>/);
});

test("review: a serial matches only as a whole word: not inside a WO, a phone number, a longer serial or across fields", async () => {
  const sql = await fresh();
  const short = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB1234");
  const long = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  const num = await unit(sql, "Alpha Cafe", "Zz Grinder", "8123456");
  const spaced = await unit(sql, "Alpha Cafe", "Zz Kettle", "KT 55501");
  const j1 = await ticket(sql, "Alpha Cafe", "brewer ZZB12345 leaking");
  await ticket(sql, "Alpha Cafe", "WO 98123456 callback 713-812-3456");
  await ticket(sql, "Alpha Cafe", "ends ZZB12", { workDone: "345 replaced" });
  const j4 = await ticket(sql, "Alpha Cafe", "kettle s/n: kt 55501, also #KT55501");
  const j5 = await ticket(sql, "Alpha Cafe", "grinder 8123456 jam");
  const s = await T.ticketUnitSuggestionsFor(sql, {}, "u-desk");
  const got = s.rows.map((r) => [r.jobId, r.unit.id]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(got, [[j1, long], [j4, spaced], [j5, num]].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  assert.ok(!got.some((p) => p[1] === short), "ZZB1234 isn't in ZZB12345");
  assert.equal(s.rows.find((r) => r.jobId === j5).numeric, true, "an all-digit serial is flagged, and kept out of Confirm all");
});

test("review: every spelling of Walk-In is left out, and Confirm refuses it", async () => {
  const sql = await fresh();
  const u = await unit(sql, "Walk - In", "Zz Brewer", "ZZB12345");
  const job = await ticket(sql, "Walk - In", "ZZB12345");
  assert.deepEqual((await T.ticketUnitSuggestionsFor(sql, {}, "u-desk")).rows, []);
  assert.deepEqual(await T.confirmTicketUnitSuggestionsFor(sql, { pairs: [{ jobId: job, unitId: u }] }, "u-desk"), { linked: 0, alreadyLinked: 0, skipped: 1 });
});

test("review: pages by offset past 500; an already-linked pair isn't counted as skipped; Warehouse can't dismiss", async () => {
  const sql = await fresh();
  const u = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  for (let i = 0; i < 4; i++) await ticket(sql, "Alpha Cafe", "ZZB12345");
  const p1 = await T.ticketUnitSuggestionsFor(sql, { limit: 2, offset: 0 }, "u-desk");
  const p2 = await T.ticketUnitSuggestionsFor(sql, { limit: 2, offset: 2 }, "u-desk");
  const p3 = await T.ticketUnitSuggestionsFor(sql, { limit: 2, offset: 9 }, "u-desk");
  assert.deepEqual([p1.rows.length, p2.rows.length, p3.rows.length, p3.total], [2, 2, 0, 4]);
  assert.equal(new Set([...p1.rows, ...p2.rows].map((r) => r.jobId)).size, 4);
  const pair = { jobId: p1.rows[0].jobId, unitId: u };
  await T.confirmTicketUnitSuggestionsFor(sql, { pairs: [pair] }, "u-desk");
  assert.deepEqual(await T.confirmTicketUnitSuggestionsFor(sql, { pairs: [pair] }, "u-owner"), { linked: 0, alreadyLinked: 1, skipped: 0 });
  await assert.rejects(T.dismissTicketUnitSuggestionsFor(sql, { pairs: [pair] }, "u-wh"), /Warehouse/);
});

test("review: Not this one survives Remove and Put back", async () => {
  const sql = await fresh();
  const E = await import("../src/lib/ops/account-equip-import.ts");
  const RET = await import("../src/lib/ops/account-equip-retire.ts");
  const u = await unit(sql, "Alpha Cafe", "Zz Brewer", "ZZB12345");
  const job = await ticket(sql, "Alpha Cafe", "ZZB12345");
  await T.dismissTicketUnitSuggestionsFor(sql, { pairs: [{ jobId: job, unitId: u }] }, "u-desk");
  await E.removeEquipmentUnit(sql, u, { userId: "u-owner", name: "chuy" });
  const retired = (await sql.query("select id from account_equipment_retired where unit_id = $1", [u]))[0].id;
  await RET.restoreRetiredUnit(sql, Number(retired));
  assert.deepEqual((await T.ticketUnitSuggestionsFor(sql, {}, "u-desk")).rows, []);
});
