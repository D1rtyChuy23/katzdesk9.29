// Corrigo import, 10/20 run: the completed date on an existing ticket (C6).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const corrigo = await import("../src/lib/ops/corrigo.ts");
const { parseCompletedDate, parseCorrigoMatrix, resolvePreviewRow } = corrigo;

test("completed dates written as CSV text are read", () => {
  assert.equal(parseCompletedDate("Oct 19, 2026 3:45 PM"), "2026-10-19");
  assert.equal(parseCompletedDate("Mon 10/19/2026"), "2026-10-19");
  assert.equal(parseCompletedDate("Monday, Oct 19, 2026"), "2026-10-19");
  assert.equal(parseCompletedDate("Sept 9 2026"), "2026-09-09");
  assert.equal(parseCompletedDate("10/19/2026 9:30 PM"), "2026-10-19");
  assert.equal(parseCompletedDate("2026-10-19"), "2026-10-19");
  assert.equal(parseCompletedDate("Soon"), null);
});

test("Corrigo's completed date wins on an existing ticket unless it is billed", () => {
  const { completedOnUpdate } = corrigo;
  assert.deepEqual(completedOnUpdate("2026-10-19", "2026-10-12", null), { value: "2026-10-19", change: "moved" });
  assert.deepEqual(completedOnUpdate("2026-10-19", null, null), { value: "2026-10-19", change: "set" });
  assert.deepEqual(completedOnUpdate("2026-10-19", "2026-10-12", "SO-1001"), { value: "2026-10-12", change: "billed" });
  assert.deepEqual(completedOnUpdate("2026-10-19", "2026-10-12", "  "), { value: "2026-10-19", change: "moved" });
  assert.deepEqual(completedOnUpdate(null, "2026-10-12", null), { value: "2026-10-12", change: null });
  assert.deepEqual(completedOnUpdate("2026-10-12", "2026-10-12", null), { value: "2026-10-12", change: null });
});

const rec = (over = {}) => ({
  rawWo: "WO-0772",
  matchKey: "772",
  canonicalWo: "WO-0772",
  technician: null,
  completedAt: "2026-10-19",
  completedRaw: "10/19/2026",
  workDone: null,
  statusRaw: "Completed",
  issue: null,
  customer: "Cafe A",
  po: null,
  callType: null,
  ...over,
});
const hit = (over = {}) => ({ board: "service", id: 7, status: "Completed", customer: "Cafe A", wo: "WO-0772", done: true, completedAt: "2026-10-12", ...over });

test("the preview shows the desk's completed date next to Corrigo's, with a note when it won't move or should be checked", () => {
  const plain = resolvePreviewRow(rec(), { unique: hit(), conflicts: [] });
  assert.equal(plain.oldCompletedAt, "2026-10-12");
  assert.equal(plain.completedAt, "2026-10-19");
  assert.equal(plain.completedNote, null);
  assert.equal(
    resolvePreviewRow(rec(), { unique: hit({ billedSo: "SO-1001" }), conflicts: [] }).completedNote,
    "billed on SO-1001 — keeps 2026-10-12",
  );
  assert.equal(
    resolvePreviewRow(rec(), { unique: hit({ hasCharges: true }), conflicts: [] }).completedNote,
    "has charges, not billed yet — check it wasn't in an earlier export",
  );
  const unread = parseCorrigoMatrix([["ST#", "Date/Time Completed"], ["WO-0772", "19 Okt 2026"]]).records[0];
  assert.equal(unread.completedAt, null);
  assert.equal(resolvePreviewRow(unread, { unique: hit(), conflicts: [] }).completedNote, `couldn't read the date "19 Okt 2026"`);
});

async function freshDb() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

async function ticket(sql, wo, nsSo = null) {
  const rows = await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, done, completed_at, ns_so) values ('service', $1, 'Cafe A', $2, 'Completed', true, '2026-10-12', $3) returning id",
    [`SC-${wo}`, wo, nsSo],
  );
  return rows[0].id;
}

const dateOf = async (sql, id) =>
  (await sql.query("select to_char(completed_at, 'YYYY-MM-DD') as d from service_jobs where id = $1", [id]))[0].d;
const lastLog = async (sql, id) =>
  (await sql.query("select detail from activity where entity_id = $1 and action = 'corrigo' order by id desc limit 1", [id]))[0].detail;

test("apply moves an unbilled ticket's completed date, keeps a billed one, and logs both", async () => {
  const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
  const sql = await freshDb();
  const open = await ticket(sql, "WO-0772");
  const billed = await ticket(sql, "WO-0773", "SO-1001");
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Date/Time Completed", "Customer Name"],
    ["0772", "Completed", "Oct 19, 2026 3:45 PM", "Cafe A"],
    ["0773", "Completed", "10/19/2026", "Cafe A"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal(await dateOf(sql, open), "2026-10-19");
  assert.match(await lastLog(sql, open), /completed 2026-10-12 → 2026-10-19/);
  assert.equal(await dateOf(sql, billed), "2026-10-12");
  assert.match(await lastLog(sql, billed), /completed kept 2026-10-12 \(billed; Corrigo says 2026-10-19\)/);
});

test("a Sales Order saved between preview and apply keeps the ticket's date", async () => {
  const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
  const sql = await freshDb();
  const id = await ticket(sql, "WO-0774");
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Date/Time Completed"], ["0774", "Completed", "10/19/2026"]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].completedNote, null);
  // The SO lands after apply has read the ticket, just before its update runs.
  const realQuery = sql.query;
  sql.query = async (text, params) => {
    if (/^\s*update service_jobs set/.test(text)) await realQuery("update service_jobs set ns_so = 'SO-2002' where id = $1", [id]);
    return realQuery(text, params);
  };
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal(await dateOf(sql, id), "2026-10-12");
});
