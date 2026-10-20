// Corrigo import, Chuy's 10/20 decisions: the 365-day wrap rule, reopening a ticket, attaching an install by equipment.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
const { addDays, todayChicago } = await import("../src/lib/ops/clock.ts");
const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");

async function freshDb() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

const daysAgo = (n) => addDays(todayChicago(), -n);

/** A desk past WO-9999, so ST# numbers have started over. */
async function wrappedDesk() {
  const sql = await freshDb();
  await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, done, received) values ('service', 'SC-9999', 'Old Cafe', 'WO-9999', 'Completed', true, $1)",
    [daysAgo(500)],
  );
  return sql;
}

async function closedTicket(sql, wo, customer, received) {
  const rows = await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, done, received, completed_at) values ('service', $1, $2, $3, 'Completed', true, $4, $5) returning id",
    [`SC-${wo}-${Math.random()}`, customer, wo, received, received],
  );
  return rows[0].id;
}

const woRows = async (sql, digits) => (await sql.query("select id from service_jobs where wo like $1 order by id", [`%${digits}`])).map((r) => r.id);

test("wrap: a closed ticket received in the last 365 days is the same ticket when Corrigo spells the customer differently (WO-0772)", async () => {
  const sql = await wrappedDesk();
  const id = await closedTicket(sql, "WO-0772", "Cafe Alpha", daysAgo(30));
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name"], ["0772", "Completed", "Café Alpha LLC"]]);
  const preview = await previewCorrigoRecords(sql, records);
  const row = preview.rows[0];
  assert.equal(row.action, "update");
  assert.equal(row.jobId, id);
  assert.equal(row.wrapRepeat, false);
  assert.equal(preview.wrapCount, 0);
  assert.doesNotMatch(row.matchNote ?? "", /after 9999/);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await woRows(sql, "0772"), [id]);
});

test("wrap: with no received date the first activity entry dates the ticket", async () => {
  const sql = await wrappedDesk();
  const recent = await closedTicket(sql, "WO-0790", "Cafe Beta", null);
  await sql.query("insert into activity (entity_type, entity_id, action, created_at) values ('service', $1, 'opened', now() - interval '40 days')", [recent]);
  const old = await closedTicket(sql, "WO-0791", "Cafe Beta", null);
  await sql.query("insert into activity (entity_type, entity_id, action, created_at) values ('service', $1, 'opened', now() - interval '400 days')", [old]);
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name"],
    ["0790", "Completed", "Beta Coffee"],
    ["0791", "Completed", "Beta Coffee"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(preview.rows.map((r) => [r.action, r.jobId, r.wrapRepeat]), [["update", recent, false], ["create", null, true]]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await woRows(sql, "0790"), [recent]);
  assert.equal((await woRows(sql, "0791")).length, 2);
});

test("wrap: a closed ticket older than 365 days keeps the exact customer-name rule", async () => {
  const sql = await wrappedDesk();
  const old = await closedTicket(sql, "WO-0773", "Cafe Gamma", daysAgo(400));
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name"],
    ["0773", "Completed", "Gamma Roasters"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].action, "create");
  assert.equal(preview.rows[0].wrapRepeat, true);
  assert.match(preview.rows[0].matchNote ?? "", /used again after 9999/);
  const same = await previewCorrigoRecords(sql, parseCorrigoMatrix([["ST#", "Customer Name"], ["0773", "Cafe Gamma"]]).records);
  assert.equal(same.rows[0].jobId, old);
});

test("wrap: a WO-0772 an earlier import already duplicated attaches to the first ticket and flags the copy to merge, not as a repeat", async () => {
  const sql = await wrappedDesk();
  const first = await closedTicket(sql, "WO-0772", "Cafe Alpha", daysAgo(30));
  const copy = await closedTicket(sql, "WO-0772", "Café Alpha LLC", daysAgo(10));
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name"], ["0772", "Completed", "Café Alpha LLC"]]);
  const preview = await previewCorrigoRecords(sql, records);
  const row = preview.rows[0];
  assert.equal(row.jobId, first);
  assert.equal(row.wrapRepeat, false);
  assert.deepEqual(row.conflictIds, [{ board: "service", id: copy }]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal((await sql.query("select duplicate_of from service_jobs where id = $1", [copy]))[0].duplicate_of, first);
});

const lastLog = async (sql, type, id) =>
  (await sql.query("select detail from activity where entity_type = $1 and entity_id = $2 and action = 'corrigo' order by id desc limit 1", [type, id]))[0].detail;

async function doneTicket(sql, wo, nsSo = null) {
  const rows = await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, done, completed_at, ns_so) values ('service', $1, 'Cafe A', $2, 'Completed', true, '2026-10-12', $3) returning id",
    [`SC-${wo}`, wo, nsSo],
  );
  return rows[0].id;
}

test("reopen: an open Corrigo status with no completed date clears a service ticket's and a PM's completed date", async () => {
  const { pmIsCompleted } = await import("../src/lib/ops/pm-runbook-api.ts");
  const sql = await freshDb();
  const ticket = await doneTicket(sql, "WO-0780");
  const pm = (await sql.query("insert into pm_jobs (customer, status, wo, done, completed_at) values ('Cafe A', 'Completed', 'WO-0782', true, '2026-10-12') returning id"))[0].id;
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Date/Time Completed", "P.O. #"],
    ["0780", "Work Started", "", ""],
    ["0782", "Work Started", "", "PM"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  for (const row of preview.rows) {
    assert.equal(row.completedCleared, true, row.wo);
    assert.equal(row.completedKept, false, row.wo);
  }
  const ui = readFileSync(new URL("../src/components/desk/corrigo-import.tsx", import.meta.url), "utf8");
  assert.match(ui, /r\.completedCleared\s*\?\s*`\$\{r\.oldCompletedAt\} → \(cleared, reopened\)`/);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await sql.query("select status, done, completed_at from service_jobs where id = $1", [ticket]), [
    { status: "In Progress", done: false, completed_at: null },
  ]);
  assert.match(await lastLog(sql, "service", ticket), /completed 2026-10-12 → \(cleared, reopened\)/);
  assert.deepEqual(await sql.query("select status, done, completed_at from pm_jobs where id = $1", [pm]), [
    { status: "In Progress", done: false, completed_at: null },
  ]);
  assert.equal(await pmIsCompleted(sql, pm), false);
  assert.match(await lastLog(sql, "pm", pm), /completed 2026-10-12 → \(cleared, reopened\)/);
});

test("reopen: a billed ticket keeps its completed date, and the preview and log say so", async () => {
  const sql = await freshDb();
  const id = await doneTicket(sql, "WO-0781", "SO-1001");
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Date/Time Completed"], ["0781", "Work Started", ""]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].completedNote, "billed on SO-1001 — keeps 2026-10-12");
  assert.equal(preview.rows[0].completedKept, true);
  assert.equal(preview.rows[0].completedCleared, false);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal((await sql.query("select to_char(completed_at, 'YYYY-MM-DD') as d from service_jobs where id = $1", [id]))[0].d, "2026-10-12");
  assert.match(await lastLog(sql, "service", id), /completed kept 2026-10-12 \(billed; Corrigo reopened it\)/);
});

test("reopen: a Sales Order saved between preview and apply keeps the date (guard in the UPDATE)", async () => {
  const sql = await freshDb();
  const id = await doneTicket(sql, "WO-0783");
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Date/Time Completed"], ["0783", "Picked Up", ""]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].completedCleared, true);
  const realQuery = sql.query;
  sql.query = async (text, params) => {
    if (/^\s*update service_jobs set/.test(text)) await realQuery("update service_jobs set ns_so = 'SO-2002' where id = $1", [id]);
    return realQuery(text, params);
  };
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal((await realQuery("select to_char(completed_at, 'YYYY-MM-DD') as d from service_jobs where id = $1", [id]))[0].d, "2026-10-12");
});

test("reopen: a closed status, no status, an unmapped status, a completed date or an install never clears the date", async () => {
  const sql = await freshDb();
  const ids = [];
  for (const wo of ["WO-0784", "WO-0785", "WO-0786", "WO-0787"]) ids.push(await doneTicket(sql, wo));
  const install = (await sql.query("insert into installs (customer, wo, equip_status, complete, completed_at) values ('Cafe A', 'WO-0788', 'Installed', true, '2026-10-12') returning id"))[0].id;
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Date/Time Completed", "P.O. #"],
    ["0784", "Cancelled", "", ""],
    ["0785", "", "", ""],
    ["0786", "Attention", "", ""],
    ["0787", "Work Started", "10/19/2026", ""],
    ["0788", "Work Started", "", "Install"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(preview.rows.map((r) => r.completedCleared), [false, false, false, false, false]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  const dates = await sql.query("select to_char(completed_at, 'YYYY-MM-DD') as d from service_jobs where id = any($1::int[]) order by id", [ids]);
  assert.deepEqual(dates.map((r) => r.d), ["2026-10-12", "2026-10-12", "2026-10-12", "2026-10-19"]);
  assert.deepEqual(await sql.query("select equip_status, complete, to_char(completed_at, 'YYYY-MM-DD') as d from installs where id = $1", [install]), [
    { equip_status: "Installed", complete: true, d: "2026-10-12" },
  ]);
});
