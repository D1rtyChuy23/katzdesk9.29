// Corrigo import, 10/20 run: reading the file in the browser (C1), headers and rows (C2), statuses (C3).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import * as XLSX from "xlsx";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const corrigo = await import("../src/lib/ops/corrigo.ts");
const { parseCorrigoMatrix, resolvePreviewRow, woCanonical } = corrigo;
const none = { unique: null, conflicts: [] };

test("C2: a hand-renamed status column is read, and Operational Status wins over Status", () => {
  for (const name of ["Status", "WO Status", "Work Order Status", "Ticket Status"]) {
    const { records } = parseCorrigoMatrix([["ST#", name], ["WO-0900", "Work Started"]]);
    assert.equal(records[0].statusRaw, "Work Started", name);
  }
  const both = parseCorrigoMatrix([["ST#", "Status", "Operational Status"], ["WO-0900", "Open", "Completed"]]);
  assert.equal(both.records[0].statusRaw, "Completed");
  assert.equal(both.columns.status, "Operational Status");
});

test("C2: completed date is read from Completed Date, Completion Date and Completed On", () => {
  for (const name of ["Completed Date", "Completion Date", "Completed On"]) {
    const { records } = parseCorrigoMatrix([["ST#", name], ["WO-0772", "10/19/2026"]]);
    assert.equal(records[0].completedAt, "2026-10-19", name);
  }
});

test("C2: TextBox headers fail with the headers found, the expected names and the Excel hint", () => {
  assert.throws(
    () => parseCorrigoMatrix([["TextBox_12", "TextBox_15"], ["WO-0855", "Completed"]]),
    (e) =>
      /Headers found: TextBox_12, TextBox_15/.test(e.message) &&
      /Expected headers: ST#/.test(e.message) &&
      /CSV export/.test(e.message),
  );
});

test("C2: the TextBox table maps Corrigo's CSV names (empty until Chuy supplies the mapping)", () => {
  assert.deepEqual(corrigo.CORRIGO_TEXTBOX_HEADERS, {});
  const aliases = { "textbox 12": "wo", "textbox 15": "status", "textbox 18": "completedAt" };
  Object.assign(corrigo.CORRIGO_TEXTBOX_HEADERS, aliases);
  try {
    const out = parseCorrigoMatrix([["TextBox_12", "TextBox_15", "TextBox_18"], ["WO-0855", "Completed", "10/19/2026"]]);
    assert.equal(out.records[0].canonicalWo, "WO-0855");
    assert.equal(out.records[0].statusRaw, "Completed");
    assert.equal(out.records[0].completedAt, "2026-10-19");
    assert.deepEqual(out.columns, { wo: "TextBox_12", status: "TextBox_15", completedAt: "TextBox_18" });
  } finally {
    for (const k of Object.keys(aliases)) delete corrigo.CORRIGO_TEXTBOX_HEADERS[k];
  }
});

test("C2: a header row below report title rows is found", () => {
  const out = parseCorrigoMatrix([
    ["List of Service Tickets with Cost"], ["Run 10/20/2026"], ["Filter"], ["Company"], ["Range"], ["Note"],
    ["ST#", "Operational Status"],
    ["WO-0772", "Completed"],
  ]);
  assert.equal(out.records[0].canonicalWo, "WO-0772");
});

test("C2: the parse reports which header fed each field and a missing status or completed column", () => {
  const out = parseCorrigoMatrix([["ST#", "Customer Name"], ["WO-0901", "Cafe B"]]);
  assert.deepEqual(out.columns, { wo: "ST#", customer: "Customer Name" });
  assert.deepEqual(out.missing, ["status", "completedAt"]);
});

test("C2: a cost line for the same ST# doesn't blank the ticket line, and a later non-blank cell wins", () => {
  const head = ["ST#", "Operational Status", "Date/Time Completed", "Primary Service Tech", "Work Done", "Total Invoice"];
  const blank = parseCorrigoMatrix([
    head,
    ["WO-0772", "Completed", "10/19/2026 3:45:00 PM", "Ryan", "Replaced gasket", "120.00"],
    ["WO-0772", "", "", "", "", "35.00"],
  ]);
  assert.equal(blank.records.length, 1);
  assert.equal(blank.records[0].statusRaw, "Completed");
  assert.equal(blank.records[0].completedAt, "2026-10-19");
  assert.equal(blank.records[0].technician, "Ryan");
  assert.equal(blank.records[0].workDone, "Replaced gasket");
  const later = parseCorrigoMatrix([head, ["WO-0772", "Work Started", "", "Ryan", "", ""], ["772", "Completed", "10/19/2026", "", "", ""]]);
  assert.equal(later.records[0].statusRaw, "Completed");
  assert.equal(later.records[0].completedAt, "2026-10-19");
  assert.equal(later.records[0].technician, "Ryan");
});

test("C2: a row whose ST# isn't a number (Total) is skipped, not imported as WO-TOTAL", () => {
  const out = parseCorrigoMatrix([["ST#", "Operational Status"], ["WO-0772", "Completed"], ["Total", "3"], ["", "x"]]);
  assert.deepEqual(out.records.map((r) => r.canonicalWo), ["WO-0772"]);
  assert.equal(out.skipped, 2);
});

test("C2: leading zeros are kept — a 1-3 digit ST# is padded to 4", () => {
  assert.equal(woCanonical("855"), "WO-0855");
  assert.equal(woCanonical("0870"), "WO-0870");
  assert.equal(woCanonical("3"), "WO-0003");
  assert.equal(woCanonical("WO-12345"), "WO-12345");
});

test("C1: the browser parse keeps a 9 PM finish on its own day", () => {
  const before = process.env.TZ;
  process.env.TZ = "America/Chicago";
  try {
    assert.equal(corrigo.stringifyCell(new Date(2026, 9, 19, 21, 30)), "2026-10-19");
  } finally {
    process.env.TZ = before;
  }
});

test("C1: an xlsx is read in the browser path", async () => {
  const { parseCorrigoBytes } = await import("../src/lib/ops/corrigo-file.ts");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["ST#", "Operational Status", "Date/Time Completed"], [855, "Completed", new Date(2026, 9, 19, 21, 30)]]),
    "S",
  );
  const out = parseCorrigoBytes(XLSX, XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  assert.equal(out.records[0].canonicalWo, "WO-0855");
  assert.equal(out.records[0].completedAt, "2026-10-19");
});

test("C1: chunks stay under the request budget and keep every row in order", () => {
  const items = Array.from({ length: 2500 }, (_, i) => ({ matchKey: String(i), workDone: "x".repeat(900) }));
  const chunks = corrigo.chunkByBytes(items, 1_500_000, 300);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(c.length <= 300);
    assert.ok(new TextEncoder().encode(JSON.stringify(c)).length <= 1_500_000 + c.length);
  }
  assert.deepEqual(chunks.flat().map((x) => x.matchKey), items.map((x) => x.matchKey));
});

test("C1: chunk previews merge into one", () => {
  const part = (n, unmapped) => ({ updateCount: n, createCount: 1, skipped: 0, conflictCount: 0, wrapCount: 0, unmapped, rows: [{ wo: `WO-${n}` }] });
  const out = corrigo.mergeCorrigoPreviews([part(2, ["Attention"]), part(3, ["Attention", "Hold"])], {
    skipped: 4,
    columns: { wo: "ST#" },
    missing: ["completedAt"],
  });
  assert.equal(out.updateCount, 5);
  assert.equal(out.createCount, 2);
  assert.equal(out.skipped, 4);
  assert.deepEqual(out.unmapped, ["Attention", "Hold"]);
  assert.deepEqual(out.rows.map((r) => r.wo), ["WO-2", "WO-3"]);
  assert.deepEqual(out.missing, ["completedAt"]);
});

const rec = (statusRaw, extra = {}) => ({
  rawWo: "WO-0950", matchKey: "950", canonicalWo: "WO-0950", technician: null, completedAt: null, workDone: null,
  statusRaw, issue: null, customer: "Cafe", po: null, callType: null, ...extra,
});
const hit = (board, status) => ({ unique: { board, id: 1, status, customer: "Cafe", wo: "WO-0950" }, conflicts: [] });

test("C3: statuses map per board, and the preview shows the board's own status", () => {
  assert.equal(resolvePreviewRow(rec("Waiting for Pickup"), none).newStatus, "Dispatched");
  assert.equal(resolvePreviewRow(rec("Work Started"), none).newStatus, "In Progress");
  assert.equal(resolvePreviewRow(rec("Waiting for Pickup", { po: "PM-1" }), none).newStatus, "Scheduled");
  assert.equal(resolvePreviewRow(rec("Picked Up", { po: "PM-1" }), none).newStatus, "Ready to Dispatch");
  assert.equal(resolvePreviewRow(rec("Unassigned", { po: "PM-1" }), none).newStatus, "Pending Scheduling");
  assert.equal(resolvePreviewRow(rec("On Hold"), hit("pm", "Scheduled")).newStatus, "Scheduled");
  assert.equal(resolvePreviewRow(rec("Work Started", { po: "Install" }), none).newStatus, "Ready");
  assert.equal(resolvePreviewRow(rec("Completed", { po: "Install" }), none).newStatus, "Installed");
  assert.equal(resolvePreviewRow(rec("Waiting for Pickup"), hit("install", "Not Ready")).newStatus, "Not Ready");
  assert.match(resolvePreviewRow(rec("Waiting for Pickup"), hit("install", "Not Ready")).statusNote ?? "", /no install status → keeps Not Ready/);
  assert.equal(resolvePreviewRow(rec("Work Started"), hit("install", "Installed")).newStatus, "Installed");
  assert.equal(resolvePreviewRow(rec("Cancelled"), hit("install", "Ready")).newStatus, "Ready");
});

test("C3: no status keeps the ticket's status (Completed with a completed date) and says so", () => {
  const row = resolvePreviewRow(rec(null), hit("service", "Dispatched"));
  assert.equal(row.newStatus, "Dispatched");
  assert.equal(row.statusNote, "no status in file → keeps Dispatched");
  assert.equal(resolvePreviewRow(rec(null, { completedAt: "2026-10-19" }), hit("service", "Dispatched")).newStatus, "Completed");
  assert.equal(resolvePreviewRow(rec(null, { po: "Install" }), none).statusNote, "no status in file → opens as Not Ready");
});

test("C3: a status not in the table is marked unmapped and shows what it becomes", () => {
  const row = resolvePreviewRow(rec("Attention", { po: "PM-2" }), none);
  assert.equal(row.statusUnmapped, "Attention");
  assert.equal(row.newStatus, "Pending Scheduling");
  assert.equal(row.statusNote, "unmapped: Attention → opens as Pending Scheduling");
  assert.equal(resolvePreviewRow(rec("constructor"), hit("service", "Open")).statusUnmapped, "constructor");
});

async function freshDb() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

async function statusOf(sql, board, wo) {
  if (board === "pm") return (await sql.query("select status, wo from pm_jobs where wo = $1", [wo]))[0];
  if (board === "install") return (await sql.query("select equip_status as status, wo from installs where wo = $1", [wo]))[0];
  return (await sql.query("select status, wo from service_jobs where wo = $1", [wo]))[0];
}

test("C3: the status the preview shows is the status apply writes, on every board", async () => {
  const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
  const sql = await freshDb();
  await sql.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-1', 'Cafe', 'WO-0801', 'Dispatched')");
  await sql.query("insert into pm_jobs (customer, status, wo) values ('Cafe', 'Scheduled', 'WO-0802')");
  await sql.query("insert into installs (customer, equip_status, wo) values ('Cafe', 'Ready', 'WO-0803')");
  const { records } = parseCorrigoMatrix([
    ["ST#", "Status", "Customer Name", "P.O. #"],
    ["801", "", "Cafe", ""],
    ["802", "Work Started", "Cafe", "PM"],
    ["803", "Waiting for Pickup", "Cafe", "Install"],
    ["804", "Waiting for Pickup", "Cafe", "PM"],
    ["805", "Work Started", "Cafe", "Install"],
    ["806", "Attention", "Cafe", ""],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  for (const row of preview.rows) {
    assert.equal((await statusOf(sql, row.board, row.wo)).status, row.newStatus, row.wo);
  }
  assert.deepEqual(
    preview.rows.map((r) => `${r.wo}:${r.newStatus}`),
    ["WO-0801:Dispatched", "WO-0802:In Progress", "WO-0803:Ready", "WO-0804:Scheduled", "WO-0805:Ready", "WO-0806:Open"],
  );
});

test("C2: an update keeps the stored WO-0870 when the file says 870", async () => {
  const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
  const sql = await freshDb();
  await sql.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-1', 'Cafe', 'WO0870', 'Open')");
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status"], ["870", "Completed"]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].action, "update");
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await statusOf(sql, "service", "WO0870"), { status: "Completed", wo: "WO0870" });
});
