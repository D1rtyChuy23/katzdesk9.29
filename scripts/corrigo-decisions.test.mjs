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
