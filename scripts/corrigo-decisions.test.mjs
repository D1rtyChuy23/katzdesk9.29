// Corrigo import, Chuy's 10/20 decisions: the 365-day wrap rule, reopening a ticket, attaching an install by equipment.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
// The production equipment catalog (the same 151 names as directory_equipment in the parity copy).
import realCatalog from "../src/lib/ops/directory-equipment.json" with { type: "json" };

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { descriptionNames, exactMachines, parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
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

test("wrap: a WO-0772 copy an earlier import made under Corrigo's spelling gets the row; the first, spelled differently, is named and left alone", async () => {
  const sql = await wrappedDesk();
  const first = await closedTicket(sql, "WO-0772", "Cafe Alpha", daysAgo(30));
  const copy = await closedTicket(sql, "WO-0772", "Café Alpha LLC", daysAgo(10));
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name"], ["0772", "Completed", "Café Alpha LLC"]]);
  const preview = await previewCorrigoRecords(sql, records);
  const row = preview.rows[0];
  // Two spellings could be two customers, so nothing is merged: the For Review entry names the other ticket.
  assert.deepEqual([row.jobId, row.wrapRepeat, row.conflictIds], [copy, true, null]);
  assert.equal(row.shared, `WO-0772 is also on service #${first} (Cafe Alpha)`);
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(
    res.review.map((r) => [r.id, r.reason, r.note]),
    [[copy, "wrap", `WO-0772 is also on service #${first} (Cafe Alpha)`]],
  );
  assert.deepEqual(
    (await sql.query("select customer, duplicate_of from service_jobs where id = any($1::int[]) order by id", [[first, copy]])),
    [{ customer: "Cafe Alpha", duplicate_of: null }, { customer: "Café Alpha LLC", duplicate_of: null }],
  );
});

test("wrap: a WO-0772 an earlier import already duplicated for the same customer attaches to the first and merges the copy", async () => {
  const sql = await wrappedDesk();
  const first = await closedTicket(sql, "WO-0772", "Cafe Alpha LLC", daysAgo(30));
  const copy = await closedTicket(sql, "WO-0772", "Cafe Alpha LLC", daysAgo(10));
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name"], ["0772", "Completed", "Cafe Alpha LLC"]]);
  const preview = await previewCorrigoRecords(sql, records);
  const row = preview.rows[0];
  assert.equal(row.jobId, first);
  assert.equal(row.wrapRepeat, false);
  assert.deepEqual(row.conflictIds, [{ board: "service", id: copy }]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal((await sql.query("select duplicate_of from service_jobs where id = $1", [copy]))[0].duplicate_of, first);
});

test("wrap: one number on two of this cycle's tickets for different customers goes on the file customer's, and the other is left alone (WO-0368)", async () => {
  const sql = await wrappedDesk();
  const stella = await closedTicket(sql, "WO-0368", "Stella Southern", daysAgo(60));
  const icon = await closedTicket(sql, "WO-0368", "Hotel Icon", daysAgo(60));
  await sql.query("update service_jobs set work_done = 'Stella Southern work' where id = $1", [stella]);
  const file = (customer) =>
    parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Work Done"], ["0368", "Completed", customer, "Corrigo work"]]).records;
  const preview = await previewCorrigoRecords(sql, file("Hotel Icon"));
  const row = preview.rows[0];
  assert.deepEqual([row.action, row.jobId, row.conflictIds, row.wrapRepeat], ["update", icon, null, true]);
  assert.equal(row.shared, `WO-0368 is also on service #${stella} (Stella Southern)`);
  assert.match(row.matchNote, /WO-0368 is also on service #\d+ \(Stella Southern\)/);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  const both = await sql.query("select id, customer, work_done, duplicate_of from service_jobs where id = any($1::int[]) order by id", [[stella, icon]]);
  assert.deepEqual(both, [
    { id: stella, customer: "Stella Southern", work_done: "Stella Southern work", duplicate_of: null },
    { id: icon, customer: "Hotel Icon", work_done: "Corrigo work", duplicate_of: null },
  ]);
  // Neither customer matches: neither ticket is guessed at, in the preview or at apply.
  const other = await previewCorrigoRecords(sql, file("Hotel Icon Downtown"));
  assert.deepEqual([other.rows[0].action, other.rows[0].wrapRepeat], ["create", true]);
  assert.equal(other.rows[0].shared, `WO-0368 is also on service #${stella} (Stella Southern), service #${icon} (Hotel Icon)`);
  await applyCorrigoRows(sql, other.rows, "Chuy");
  assert.deepEqual(
    (await sql.query("select customer from service_jobs where id = any($1::int[]) order by id", [[stella, icon]])).map((r) => r.customer),
    ["Stella Southern", "Hotel Icon"],
  );
  assert.equal((await woRows(sql, "0368")).length, 3);
});

test("wrap: another customer's open ticket with the number is left alone too, and the end-of-import merge doesn't fold them", async () => {
  const sql = await wrappedDesk();
  const stella = await closedTicket(sql, "WO-0368", "Stella Southern", daysAgo(60));
  const icon = await closedTicket(sql, "WO-0368", "Hotel Icon", daysAgo(60));
  await sql.query("update service_jobs set status = 'Dispatched', done = false, work_done = 'Stella Southern work' where id = $1", [stella]);
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "Work Done"],
    ["0368", "Completed", "Hotel Icon", "Corrigo work"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual([preview.rows[0].jobId, preview.rows[0].conflictIds, preview.rows[0].wrapRepeat], [icon, null, true]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(
    await sql.query("select id, customer, status, work_done, duplicate_of from service_jobs where id = any($1::int[]) order by id", [[stella, icon]]),
    [
      { id: stella, customer: "Stella Southern", status: "Dispatched", work_done: "Stella Southern work", duplicate_of: null },
      { id: icon, customer: "Hotel Icon", status: "Completed", work_done: "Corrigo work", duplicate_of: null },
    ],
  );
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

async function installDesk() {
  const sql = await freshDb();
  await sql.query("insert into directory_equipment (name) values ('Eversys e''4m'), ('Mahlkonig E65S'), ('Bunn ITCB')");
  return sql;
}

async function openInstall(sql, customer, { machines = null, equipment = null, wo = null } = {}) {
  const json = machines ? JSON.stringify(machines.map((equipment) => ({ equipment, serial: "", powerVoltage: "" }))) : null;
  const rows = await sql.query(
    "insert into installs (customer, equipment, machines, wo, equip_status) values ($1, $2, $3, $4, 'Not Ready') returning id",
    [customer, equipment ?? (machines ? machines.join("\n") : null), json, wo],
  );
  return rows[0].id;
}

const installsOf = async (sql, customer) =>
  sql.query("select id, wo, equip_status from installs where lower(customer) = lower($1) order by id", [customer]);
const wosOf = async (sql, id) => (await sql.query("select wo from install_work_orders where install_id = $1 order by id", [id])).map((r) => r.wo);

test("install: the equipment column is read from Equipment, Asset, Asset Name, Equipment Description and Equipment Package", () => {
  for (const name of ["Equipment", "Asset", "Asset Name", "Equipment Description", "Equipment Package"]) {
    const { records, columns } = parseCorrigoMatrix([["ST#", name], ["WO-1001", "Bunn ITCB"]]);
    assert.equal(records[0].equipment, "Bunn ITCB", name);
    assert.equal(columns.equipment, name);
  }
});

test("install: a row with no WO match attaches to the account's one open install when the equipment package matches", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Delta", { machines: ["Eversys e'4m", "Mahlkonig E65S"] });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment"],
    ["1001", "Work Started", "CAFE DELTA", "Install", "Mahlkonig E65S 120v, Eversys e'4m"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const row = preview.rows[0];
  assert.deepEqual([row.action, row.board, row.jobId, row.byEquipment], ["update", "install", id, true]);
  assert.equal(row.matchNote, `install #${id} matched by account and equipment`);
  assert.equal(row.newStatus, "Ready");
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [1, 0]);
  assert.deepEqual(await installsOf(sql, "Cafe Delta"), [{ id, wo: "WO-1001", equip_status: "Ready" }]);
});

test("install: with no equipment column a problem description that is the install's machine name attaches", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Echo", { equipment: "Bunn ITCB 120v SN:ITCB064919" });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "Problem Description"],
    ["1002", "Completed", "Cafe Echo", "New install of Bunn ITCB"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual([preview.rows[0].action, preview.rows[0].jobId, preview.rows[0].newStatus], ["update", id, "Installed"]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await installsOf(sql, "Cafe Echo"), [{ id, wo: "WO-1002", equip_status: "Installed" }]);
});

// Chuy 10/21: an install row whose WO no install has preselects the account's one open install unless it names other
// equipment exactly, and an open install that already has a WO is a candidate too (a multi-day project).
test("install: no equipment named attaches to the one open install, a WO'd one too; different equipment, a different quantity or two open installs preselect a new install and say why", async () => {
  const sql = await installDesk();
  const foxtrot = await openInstall(sql, "Cafe Foxtrot", { machines: ["Eversys e'4m"] });
  const golf = await openInstall(sql, "Cafe Golf", { machines: ["Eversys e'4m"] });
  const hotel = await openInstall(sql, "Cafe Hotel", { machines: ["Bunn ITCB"] });
  const india = [await openInstall(sql, "Cafe India", { machines: ["Eversys e'4m"] }), await openInstall(sql, "Cafe India", { machines: ["Eversys e'4m"] })];
  const kilo = await openInstall(sql, "Cafe Kilo", { machines: ["Eversys e'4m"], wo: "WO-0042" });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Customer Name", "P.O. #", "Equipment", "Problem Description"],
    ["1003", "Cafe Foxtrot", "Install", "", "Install"],
    ["1004", "Cafe Golf", "Install", "Eversys e'4m, Mahlkonig E65S", ""],
    ["1005", "Cafe Hotel", "Install", "2 x Bunn ITCB", ""],
    ["1006", "Cafe India", "Install", "Eversys e'4m", ""],
    ["1007", "Cafe Kilo", "Install", "Eversys e'4m", ""],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(
    preview.rows.map((r) => [r.action, r.jobId, r.matchNote]),
    [
      ["update", foxtrot, `install #${foxtrot} is the account's only open install`],
      ["create", null, `equipment differs from install #${golf}`],
      ["create", null, `equipment differs from install #${hotel}`],
      ["create", null, "two installs could match"],
      ["update", kilo, `install #${kilo} matched by account and equipment`],
    ],
  );
  // Every row with candidates gets the picker: each candidate, then Create new; a preselected new install keeps them.
  assert.deepEqual(
    preview.rows.map((r) => [r.installChoice, r.installOptions?.map((o) => o.id)]),
    [
      [foxtrot, [foxtrot, null]],
      [null, [golf, null]],
      [null, [hotel, null]],
      [null, [...india, null]],
      [kilo, [kilo, null]],
    ],
  );
  assert.equal(preview.rows[4].installOptions[0].label, `Attach to install #${kilo} · Eversys e'4m · Not Ready · WO-0042`);
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [2, 3]);
  assert.deepEqual(await installsOf(sql, "Cafe Foxtrot"), [{ id: foxtrot, wo: "WO-1003", equip_status: "Not Ready" }]);
  assert.equal((await installsOf(sql, "Cafe India")).filter((r) => r.wo === "WO-1006").length, 1);
  assert.equal((await installsOf(sql, "Cafe India")).filter((r) => !r.wo).length, 2);
  assert.deepEqual(await installsOf(sql, "Cafe Kilo"), [{ id: kilo, wo: "WO-0042", equip_status: "Not Ready" }]);
  assert.deepEqual(await wosOf(sql, kilo), ["WO-0042", "WO-1007"]);
});

test("install: two rows for one open install both go on it — the second as another work order, in one chunk or across chunks", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Juliet", { machines: ["Eversys e'4m"] });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Customer Name", "P.O. #", "Equipment"],
    ["1101", "Cafe Juliet", "Install", "Eversys e'4m"],
    ["1102", "Cafe Juliet", "Install", "Eversys e'4m"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(preview.rows.map((r) => [r.action, r.jobId]), [["update", id], ["update", id]]);
  assert.equal(preview.rows[1].matchNote, `install #${id} matched by account and equipment`);
  // The second row's picker shows the first row's WO on the install.
  assert.match(preview.rows[1].installOptions[0].label, /· WO-1101$/);
  const later = await previewCorrigoRecords(sql, records.slice(1));
  assert.deepEqual([later.rows[0].action, later.rows[0].jobId], ["update", id]);
  // The browser settles the rows of every chunk again, in file order.
  const ui = readFileSync(new URL("../src/components/desk/corrigo-import.tsx", import.meta.url), "utf8");
  assert.match(ui, /settleInstallRows\(/);
  assert.doesNotMatch(ui, /claimedInstalls/);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual((await installsOf(sql, "Cafe Juliet")).map((r) => [r.id === id, r.wo]), [[true, "WO-1101"]]);
  assert.deepEqual(await wosOf(sql, id), ["WO-1101", "WO-1102"]);
});

test("install: an install given another WO after the preview keeps it as its first WO and takes the row's as another", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Lima", { machines: ["Bunn ITCB"] });
  const { records } = parseCorrigoMatrix([["ST#", "Customer Name", "P.O. #", "Equipment"], ["1201", "Cafe Lima", "Install", "Bunn ITCB"]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].jobId, id);
  await sql.query("update installs set wo = 'WO-5555' where id = $1", [id]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual((await installsOf(sql, "Cafe Lima")).map((r) => [r.id === id, r.wo]), [[true, "WO-5555"]]);
  assert.deepEqual(await wosOf(sql, id), ["WO-5555", "WO-1201"]);
});

// Review fixes: real catalog spellings, a wrapped desk with both cycles of one number, and apply races.

test("install: with the real catalog and no equipment column, the problem description finds the account's open install", async () => {
  const sql = await freshDb();
  await sql.query("insert into directory_equipment (name) select unnest($1::text[])", [realCatalog]);
  const mike = await openInstall(sql, "Cafe Mike", { equipment: "Eversys Cameo c'2s" });
  const november = await openInstall(sql, "Cafe November", { machines: ['Bunn ITCB-DV, 29" w/Flip Tray'] });
  const oscar = await openInstall(sql, "Cafe Oscar", { equipment: "Bunn ITCB 120v SN:ITCB064919\nEversys Cameo c'2s - 2 Step Classic" });
  const papa = await openInstall(sql, "Cafe Papa", { machines: ["Eversys Cameo c'2s - 2 Step Classic"] });
  const quebec = await openInstall(sql, "Cafe Quebec", { machines: ["Eversys Cameo c'2s - 2 Step Classic"] });
  const romeo = await openInstall(sql, "Cafe Romeo", { machines: ['Bunn ITCB-DV, 29" w/Flip Tray'] });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Problem Description"],
    ["0663", "Work Started", "Cafe Mike", "", "Install Eversys Cameo c'2s"],
    ["0664", "Work Started", "Cafe November", "", "New install of Bunn ITCB-DV, 29\" w/Flip Tray"],
    ["0665", "Work Started", "Cafe Oscar", "", "Install new Cameo c'2s; Bunn ITCB"],
    ["0666", "Work Started", "Cafe Papa", "Install", "Install"],
    ["0667", "Work Started", "Cafe Quebec", "Install", "Set up"],
    ["0668", "Work Started", "Cafe Romeo", "Install", "Brewer"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const only = (id) => `install #${id} is the account's only open install`;
  assert.deepEqual(
    preview.rows.map((r) => [r.wo, r.action, r.jobId, r.byEquipment, r.matchNote]),
    [
      ["WO-0663", "update", mike, true, `install #${mike} matched by account and equipment`],
      ["WO-0664", "update", november, true, `install #${november} matched by account and equipment`],
      // Nothing here names other equipment exactly (Oscar's "Bunn ITCB" isn't a catalog spelling): the one open install.
      ["WO-0665", "update", oscar, false, only(oscar)],
      ["WO-0666", "update", papa, false, only(papa)],
      ["WO-0667", "update", quebec, false, only(quebec)],
      ["WO-0668", "update", romeo, false, only(romeo)],
    ],
  );
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [6, 0]);
  for (const [id, wo] of [[mike, "WO-0663"], [november, "WO-0664"], [oscar, "WO-0665"], [papa, "WO-0666"], [quebec, "WO-0667"], [romeo, "WO-0668"]]) {
    assert.equal((await sql.query("select wo from installs where id = $1", [id]))[0].wo, wo);
  }
});

const ticketRow = async (sql, id) =>
  (
    await sql.query(
      "select customer, status, to_char(completed_at, 'YYYY-MM-DD') as completed, duplicate_of from service_jobs where id = $1",
      [id],
    )
  )[0];

test("wrap: this cycle's ticket wins over an old-cycle copy of the number, which is neither a conflict nor merged", async () => {
  const sql = await wrappedDesk();
  // A: both cycles spelled like the file. B: only the old-cycle copy is spelled like the file. C: the old copy is another customer's.
  const aOld = await closedTicket(sql, "WO-0790", "Cafe Alpha", daysAgo(700));
  const aNew = await closedTicket(sql, "WO-0790", "Cafe Alpha", daysAgo(20));
  const bOld = await closedTicket(sql, "WO-0791", "Alpha Coffee Co", daysAgo(700));
  const bNew = await closedTicket(sql, "WO-0791", "Cafe Alpha", daysAgo(20));
  const cOld = await closedTicket(sql, "WO-0793", "Old Bistro", daysAgo(700));
  const cNew = await closedTicket(sql, "WO-0793", "Cafe Alpha", daysAgo(20));
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "Date/Time Completed"],
    ["0790", "Completed", "Cafe Alpha", "10/19/2026"],
    ["0791", "Completed", "Alpha Coffee Co", "10/19/2026"],
    ["0793", "Completed", "Cafe Alpha", "10/19/2026"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(
    preview.rows.map((r) => [r.wo, r.action, r.jobId, r.wrapRepeat, r.conflictIds, r.oldCompletedAt]),
    [
      ["WO-0790", "update", aNew, false, null, daysAgo(20)],
      ["WO-0791", "update", bNew, false, null, daysAgo(20)],
      ["WO-0793", "update", cNew, false, null, daysAgo(20)],
    ],
  );
  assert.equal(preview.wrapCount, 0);
  assert.equal(preview.conflictCount, 0);
  for (const r of preview.rows) assert.doesNotMatch(r.matchNote ?? "", /after 9999/, r.wo);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  for (const id of [aNew, bNew, cNew]) {
    const t = await ticketRow(sql, id);
    assert.deepEqual([t.completed, t.duplicate_of], ["2026-10-19", null], `#${id}`);
  }
  assert.deepEqual(await ticketRow(sql, aOld), { customer: "Cafe Alpha", status: "Completed", completed: daysAgo(700), duplicate_of: null });
  assert.deepEqual(await ticketRow(sql, bOld), { customer: "Alpha Coffee Co", status: "Completed", completed: daysAgo(700), duplicate_of: null });
  assert.deepEqual(await ticketRow(sql, cOld), { customer: "Old Bistro", status: "Completed", completed: daysAgo(700), duplicate_of: null });
});

test("wrap: Corrigo reopening a number with both cycles on the desk reopens this cycle's ticket, and the DB matches the preview", async () => {
  const sql = await wrappedDesk();
  const old = await closedTicket(sql, "WO-0790", "Cafe Alpha", daysAgo(700));
  const recent = await closedTicket(sql, "WO-0790", "Cafe Alpha", daysAgo(20));
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Date/Time Completed"], ["0790", "Work Started", "Cafe Alpha", ""]]);
  const preview = await previewCorrigoRecords(sql, records);
  const row = preview.rows[0];
  assert.deepEqual([row.jobId, row.oldCompletedAt, row.completedCleared, row.newStatus], [recent, daysAgo(20), true, "In Progress"]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await ticketRow(sql, recent), { customer: "Cafe Alpha", status: row.newStatus, completed: null, duplicate_of: null });
  assert.deepEqual(await ticketRow(sql, old), { customer: "Cafe Alpha", status: "Completed", completed: daysAgo(700), duplicate_of: null });
});

test("wrap: at apply a row previewed as new attaches to this cycle's ticket, not the old-cycle copy", async () => {
  const sql = await wrappedDesk();
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Date/Time Completed"], ["0794", "Completed", "Cafe Alpha", "10/19/2026"]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].action, "create");
  const old = await closedTicket(sql, "WO-0794", "Cafe Alpha", daysAgo(700));
  const recent = await closedTicket(sql, "WO-0794", "Cafe Alpha", daysAgo(20));
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [1, 0]);
  assert.equal((await ticketRow(sql, recent)).completed, "2026-10-19");
  assert.deepEqual(await ticketRow(sql, old), { customer: "Cafe Alpha", status: "Completed", completed: daysAgo(700), duplicate_of: null });
});

test("wrap: no received date and no activity dates a ticket by its completed date; the first activity counts on its Chicago day", async () => {
  const sql = await wrappedDesk();
  const done = (
    await sql.query(
      "insert into service_jobs (kind, call_id, customer, wo, status, done, completed_at) values ('service', 'SC-0795', 'Cafe Sierra', 'WO-0795', 'Completed', true, $1) returning id",
      [daysAgo(10)],
    )
  )[0].id;
  const edge = await closedTicket(sql, "WO-0796", "Cafe Tango", null);
  // 03:00 UTC on the day 365 days ago is the evening before in Chicago: 366 days ago.
  await sql.query("insert into activity (entity_type, entity_id, action, created_at) values ('service', $1, 'opened', $2)", [edge, `${daysAgo(365)}T03:00:00Z`]);
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name"],
    ["0795", "Completed", "Sierra Coffee"],
    ["0796", "Completed", "Tango Coffee"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(preview.rows.map((r) => [r.action, r.jobId, r.wrapRepeat]), [["update", done, false], ["create", null, true]]);
});

test("install: an equipment-matched install archived or completed after the preview gets a new install instead, counted", async () => {
  const sql = await installDesk();
  const uniform = await openInstall(sql, "Cafe Uniform", { machines: ["Bunn ITCB"] });
  const victor = await openInstall(sql, "Cafe Victor", { machines: ["Bunn ITCB"] });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment"],
    ["1301", "Work Started", "Cafe Uniform", "Install", "Bunn ITCB"],
    ["1302", "Work Started", "Cafe Victor", "Install", "Bunn ITCB"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(preview.rows.map((r) => [r.jobId, r.byEquipment]), [[uniform, true], [victor, true]]);
  await sql.query("update installs set archived = true where id = $1", [uniform]);
  await sql.query("update installs set complete = true, equip_status = 'Installed' where id = $1", [victor]);
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [0, 2]);
  assert.deepEqual((await installsOf(sql, "Cafe Uniform")).map((r) => [r.id === uniform, r.wo]), [[true, null], [false, "WO-1301"]]);
  assert.deepEqual(
    (await installsOf(sql, "Cafe Victor")).map((r) => [r.id === victor, r.wo, r.equip_status]),
    [[true, null, "Installed"], [false, "WO-1302", "Ready"]],
  );
});

test("install: the activity log says when an install was matched by account and equipment", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Whiskey", { machines: ["Bunn ITCB"] });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment", "Date/Time Completed"],
    ["1401", "Completed", "Cafe Whiskey", "Install", "Bunn ITCB", "10/19/2026"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal(await lastLog(sql, "install", id), "Corrigo import · WO-1401 · completed 2026-10-19 · matched by account and equipment");
});

test("reopen: a completed date Corrigo wrote but that can't be read does not reopen the ticket", async () => {
  const sql = await freshDb();
  const id = await doneTicket(sql, "WO-0807");
  const { records } = parseCorrigoMatrix([["ST#", "Operational Status", "Date/Time Completed"], ["0807", "Work Started", "not a date"]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].completedCleared, false);
  assert.equal(preview.rows[0].completedNote, 'couldn\'t read the date "not a date"');
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal((await ticketRow(sql, id)).completed, "2026-10-12");
  assert.doesNotMatch(await lastLog(sql, "service", id), /cleared/);
});

// N1: with no Equipment column, the problem description (never the work done) names the account's one open install's
// machine only when, filler words and a leading "N x" aside, it is exactly that machine's catalog name: in full or
// before " - ", with or without the brand, and no other catalog model shares that spelling or starts with it.

test("install: free text names the install's machine only when the description is exactly its catalog name", () => {
  const cameo = "Eversys Cameo c'2s - 2 Step Classic";
  const itcb = 'Bunn ITCB-DV, 29" w/Flip Tray';
  const e65s = "Mahlkonig E65S GBW Espresso Grinder";
  const g92t = "Bunn G9-2T HD Dual Portion Grinder";
  const kb90s = "La Marzocco KB90 2AV with Scales";
  const enigma = "Eversys Enigma e'4s Super Traditional";
  const duke = "de Jong Duke Virtu 9236d Espresso Machine";
  const names = (text, machines) => descriptionNames(text, machines, realCatalog);
  for (const [text, machines] of [
    ["Install Eversys Cameo c'2s", [cameo]],
    ["Install new Cameo c'2s", [cameo]],
    ["Eversys Cameo C’2S", [cameo]],
    ["Install Eversys Cameo c'2s - 2 Step Classic", [cameo]],
    ["Cameo c2s install.", [cameo]],
    ["2 x Eversys Cameo c'2s", [cameo, cameo]],
    ["Install 2x new Cameo c'2s", [cameo, cameo]],
    ["Install Bunn TB3", ["Bunn TB3"]],
    ["Install TB3", ["Bunn TB3"]],
    ["Please deliver the new Bunn TB3", ["Bunn TB3"]],
    ["Bunn TB3 120V", ["Bunn TB3"]],
    ["Bunn TB3\nInstall", ["Bunn TB3"]],
    ["Install new La Marzocco Linea Mini", ["La Marzocco Linea Mini"]],
    ["Linea Mini set up", ["La Marzocco Linea Mini"]],
    ['Install Bunn ITCB-DV, 29" w/Flip Tray', [itcb]],
    ["Install La Marzocco KB90 2AV with Scales", [kb90s]],
    ["Install Eversys Enigma e'4s Super Traditional", [enigma]],
    ["Install Bunn G9-2T HD Dual Portion Grinder", [g92t]],
    ["Install Duke Virtu 9236d Espresso Machine", [duke]],
  ]) {
    assert.equal(names(text, machines), true, text);
  }
  for (const [text, machines] of [
    // Nothing, or work-done wording.
    ["", [cameo]],
    ["Install", [cameo]],
    ["Install new machine", [cameo]],
    ["Installed machine and grinder", [cameo]],
    // A second machine, with a word or with punctuation between.
    ["Install Eversys Cameo c'2s and grinder", [cameo]],
    ["Install Eversys Cameo c'2s + new machine", [cameo]],
    ["Install Eversys Cameo c'2s; Bunn ITCB", [cameo]],
    ["Eversys Cameo c'2s\nBunn TB3", [cameo]],
    ["Install Bunn TB3, Bunn TB3", ["Bunn TB3"]],
    ["Install Bunn TB3 Bunn TB3", ["Bunn TB3"]],
    ["Install Bunn TB3 & machine", ["Bunn TB3"]],
    ["Install Mahlkonig E65S grinder & espresso machine", [e65s]],
    ["Install Mahlkonig E65S grinder, espresso machine", [e65s]],
    ["Install Mahlkonig E65S grinder for the new espresso machine", [e65s]],
    ["Install Mahlkonig E65S GBW Espresso Grinder & machine", [e65s]],
    ["Install Mahlkonig E65S GBW Espresso Grinder\nInstall brewer", [e65s]],
    ["Install Bunn G9-2T HD grinder + brewer", [g92t]],
    ["Install Bunn G9-2T HD Dual Portion Grinder / brewer", [g92t]],
    ["Install Bunn G9-2T HD Dual Portion Grinder; new brewer", [g92t]],
    // Any other word, or part of a name: a brand, a code alone, generic words, "with" a filler.
    ["Install Eversys Cameo c'2s machine", [cameo]],
    ["Install Eversys Cameo c'2s (Classic)", [cameo]],
    ["Install Eversys Cameo c'2s for both bars", [cameo]],
    ["Install Cameo", [cameo]],
    ["Install c'2s", [cameo]],
    ["Install Bunn ITCB", [itcb]],
    ["New install of Bunn ITCB brewer", [itcb]],
    ["Install Bunn flip tray", [itcb]],
    ["Install Bunn TB3 brewer", ["Bunn TB3"]],
    ["Install Bunn", ["Bunn TB3"]],
    ["Install La Marzocco KB90 2AV with machine", [kb90s]],
    ["Install La Marzocco scales", [kb90s]],
    ["Install Mazzer Mini with new machine", ["Mazzer Mini Doser with Timer"]],
    ["Install Mazzer Mini", ["Mazzer Mini Doser with Timer"]],
    ["Install Mazzer Super Jolly w/ brewer", ["Mazzer Super Jolly Doser V Up w/ Timer"]],
    ["Install Rancilio grinder", ["Rancilio Kyro EVO On-Demand Grinder"]],
    ["Install Bunn dispenser", ["Bunn FMD-1 Specialty Dispenser"]],
    ["Install de Jong", [duke]],
    ["Install de Jong espresso machine", [duke]],
    ["Install steam taps", ["Modbar Steam 2 Taps, 1 Module"]],
    ["Install Bunn CWTF-APS", ["Bunn CWTF TWIN-APS"]],
    ["Install new Bunn CWTF brewer", ["Bunn CWTF TWIN-APS"]],
    ["Install Mazzer Robur S", ["Mazzer Robur S Electronic"]],
    // A spelling another model shares or starts with.
    ["Install La Marzocco KB90 2AV", ["La Marzocco KB90 2AV"]],
    ["Install Bunn CWTF15", ["Bunn CWTF15 - 3 Lower Warmers"]],
    ["Install Rancilio Classe 5 USB 1 Group Auto-Volumetric", ["Rancilio Classe 5 USB 1 Group Auto-Volumetric"]],
    // Another model, another quantity, or an install that isn't one catalog model.
    ["Install Eversys Enigma e'4s Super Traditional", ["Eversys Enigma e'4s X-Wide Super Traditional"]],
    ["Install Eversys Cameo C'2m", [cameo]],
    ["Install Bunn TB3", [cameo]],
    ["Install Eversys Cameo c'2s", [cameo, cameo]],
    ["Install 2 x Eversys Cameo c'2s", [cameo]],
    ["Install Eversys Cameo c'2s x2", [cameo, cameo]],
    ["Install 2 Eversys Cameo c'2s", [cameo, cameo]],
    ["Install two Eversys Cameo c'2s", [cameo, cameo]],
    ["Install Eversys Cameo c'2s ²", [cameo]],
    ["Install ２ x Eversys Cameo c'2s", [cameo, cameo]],
    ["Install Eversys Cameo c'2s", [cameo, "Bunn TB3"]],
    ["Install Some Unknown Brewer", ["Some Unknown Brewer"]],
    ["Install Eversys Cameo c'2s", []],
  ]) {
    assert.equal(names(text, machines), false, `${text} → ${machines.join(", ")}`);
  }
});

test("install: free text attaches only on the problem description's one machine; the work done is never read (WO-0665, WO-0666)", async () => {
  const sql = await freshDb();
  await sql.query("insert into directory_equipment (name) select unnest($1::text[])", [realCatalog]);
  const ids = {
    a: await openInstall(sql, "Cafe Alpha", { equipment: "Eversys Cameo c'2s" }),
    b: await openInstall(sql, "Cafe Bravo", { equipment: "Eversys Cameo c'2s" }),
    c: await openInstall(sql, "Cafe Charlie", { equipment: "Bunn ITCB" }),
    d: await openInstall(sql, "Cafe Dakota", { equipment: "Eversys Cameo c'2s" }),
    e: await openInstall(sql, "Cafe Easy", { equipment: "La Marzocco Linea Mini" }),
    f: await openInstall(sql, "Cafe Fox", { equipment: "Bunn ITCB" }),
    g: await openInstall(sql, "Cafe Golf", { equipment: "Bunn ITCB" }),
    h: await openInstall(sql, "Cafe Hotel", { machines: ["Eversys Cameo c'2s", "Eversys Cameo c'2s"] }),
    i: await openInstall(sql, "Cafe India", { equipment: "Eversys Cameo c'2s" }),
  };
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Problem Description", "Work Done", "Date/Time Completed"],
    ["0665", "Completed", "Cafe Alpha", "Install", "Install Eversys Cameo c'2s", "Installed both machines and grinder.", "10/19/2026"],
    ["0666", "Work Started", "Cafe Bravo", "Install", "Install 2 x Eversys Cameo c'2s", "", ""],
    ["0667", "Work Started", "Cafe Charlie", "Install", "Install Bunn ITCB and G9-2T HD grinder", "", ""],
    ["0668", "Work Started", "Cafe Dakota", "Install", "Install new Cameo c'2s and Bunn Axiom", "", ""],
    ["0669", "Work Started", "Cafe Easy", "Install", "Remove old machine and install new Linea Mini", "", ""],
    ["0670", "Work Started", "Cafe Fox", "Install", "Install new machine", "", ""],
    ["0671", "Completed", "Cafe Golf", "Install", "Install", "Installed Bunn ITCB", "10/19/2026"],
    ["0672", "Work Started", "Cafe Hotel", "Install", "2 x Eversys Cameo c'2s", "", ""],
    ["0673", "Work Started", "Cafe India", "Install", "Install Eversys Cameo c'2s (with Mahlkonig E65S grinder)", "", ""],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const none = (id) => `the problem description doesn't name install #${id}'s equipment`;
  const only = (id) => `install #${id} is the account's only open install`;
  // Only a description that is exactly other catalog machines (WO-0666: two Cameos for one) preselects a new install.
  assert.deepEqual(
    preview.rows.map((r) => [r.wo, r.action, r.jobId, r.byEquipment, r.matchNote]),
    [
      ["WO-0665", "update", ids.a, true, `install #${ids.a} matched by account and equipment`],
      ["WO-0666", "create", null, false, none(ids.b)],
      ["WO-0667", "update", ids.c, false, only(ids.c)],
      ["WO-0668", "update", ids.d, false, only(ids.d)],
      ["WO-0669", "update", ids.e, false, only(ids.e)],
      ["WO-0670", "update", ids.f, false, only(ids.f)],
      ["WO-0671", "update", ids.g, false, only(ids.g)],
      ["WO-0672", "update", ids.h, true, `install #${ids.h} matched by account and equipment`],
      ["WO-0673", "update", ids.i, false, only(ids.i)],
    ],
  );
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [8, 1]);
  assert.deepEqual(await installsOf(sql, "Cafe Alpha"), [{ id: ids.a, wo: "WO-0665", equip_status: "Installed" }]);
  assert.deepEqual(await installsOf(sql, "Cafe Hotel"), [{ id: ids.h, wo: "WO-0672", equip_status: "Ready" }]);
  assert.deepEqual((await installsOf(sql, "Cafe Bravo")).map((r) => [r.id === ids.b, r.wo]), [[true, null], [false, "WO-0666"]]);
  for (const [customer, id, wo] of [
    ["Cafe Charlie", ids.c, "WO-0667"],
    ["Cafe Dakota", ids.d, "WO-0668"],
    ["Cafe Easy", ids.e, "WO-0669"],
    ["Cafe Fox", ids.f, "WO-0670"],
    ["Cafe Golf", ids.g, "WO-0671"],
    ["Cafe India", ids.i, "WO-0673"],
  ]) {
    assert.deepEqual((await installsOf(sql, customer)).map((r) => [r.id === id, r.wo]), [[true, wo]], customer);
  }
});

// N2: the install's own machines count only when each is exactly a catalog spelling, so a loose, guessed or
// miscounted install list ("TB3 x2", "Cameo", "TB3 / ITCB") never matches, by free text or by the Equipment column.

test("install: an install's machines are read exactly — loose, partial, two-machine or miscounted text reads as nothing", () => {
  const cameo = "Eversys Cameo c'2s - 2 Step Classic";
  const exact = (text) => exactMachines(text.split("\n"), realCatalog);
  assert.deepEqual(exact("Bunn TB3"), ["Bunn TB3"]);
  assert.deepEqual(exact("TB3"), ["Bunn TB3"]);
  assert.deepEqual(exact("2 x Bunn TB3"), ["Bunn TB3", "Bunn TB3"]);
  assert.deepEqual(exact("Bunn TB3 SN 12345"), ["Bunn TB3"]);
  assert.deepEqual(exact("Eversys Cameo c'2s 120v\nSN:ABC123\nBunn TB3"), [cameo, "Bunn TB3"]);
  assert.deepEqual(exact("ICB-DV Short"), ["BUNN ICB-DV Short"]);
  assert.deepEqual(exact("Bunn TB3 Serial # 4471"), ["Bunn TB3"]);
  assert.deepEqual(exact("Bunn TB3; Bunn TB3"), ["Bunn TB3", "Bunn TB3"]);
  assert.deepEqual(exact("Mazzer Mini Electronic SN:2608789, Mazzer Robur S Electronic SN:2601514"), [
    "Mazzer Mini Electronic",
    "Mazzer Robur S Electronic",
  ]);
  assert.deepEqual(exact('Bunn ITCB-DV, 29" w/Flip Tray'), ['Bunn ITCB-DV, 29" w/Flip Tray']);
  assert.deepEqual(exact("Bunn TB3 SN12345"), ["Bunn TB3"]);
  assert.deepEqual(exact("Bunn TB3 SN: X482"), ["Bunn TB3"]);
  assert.deepEqual(exact("Bunn TB3 SN0110710025266E0006"), ["Bunn TB3"]);
  assert.deepEqual(exact("Bunn TB3\nSerial No. 12345A"), ["Bunn TB3"]);
  assert.deepEqual(exact("Bunn TB3\nS/N TB3001"), ["Bunn TB3"]);
  assert.deepEqual(exact("2 x Bunn TB3 SN: A1001\nSN: A1002"), ["Bunn TB3", "Bunn TB3"]);
  assert.deepEqual(exact("Mazzer Mini Electronic, Bunn TB3 SN: 1001"), ["Mazzer Mini Electronic", "Bunn TB3"]);
  assert.deepEqual(exact("Mazzer Mini Electronic, Bunn TB3\nSN: 1001"), ["Mazzer Mini Electronic", "Bunn TB3"]);
  assert.deepEqual(exact("Stealth 885, 90 oz Commercial Food Blender, 3.8 HP, Variable Speed"), [
    "Blendtec Stealth 885, 90 oz Commercial Food Blender, 3.8 HP, Variable Speed",
  ]);
  for (const text of [
    "",
    "Bunn TB3 x2",
    "(2) Bunn TB3",
    "2 Bunn TB3",
    "Bunn TB3 (2)",
    "TB3 / ITCB",
    "Linea Mini w/ Mazzer Mini",
    "Linea Mini + grinder",
    "Bunn TB3 & Bunn ITCB",
    "Rancilio Kyro EVO On-Demand Grinder and grinder",
    "La Marzocco",
    "Rancilio Classe",
    "Cameo",
    "Eversys Cameo",
    "Mazzer Robur",
    "La Marzocco KB90",
    "Espresso Machine",
    "Bunn ITCB 120v SN:ITCB064919",
    "Bunn CWTF15-TC",
    "Bunn CWTF15",
    "Rancilio Classe 7 USB 2 Group Tall",
    "Bunn H5X Element 120V",
    "Eversys Cameo c'2s\nCameo",
    // A serial never hides what follows it, and a line that only starts with "SN" is not a serial.
    "La Marzocco Linea Mini S/N LM1234 w/ Mazzer Mini Electronic",
    "Bunn TB3 SN: TB3001 x2",
    "Bunn TB3 Serial 4471 (2 units)",
    "Bunn TB3 SN: TB3001, TB3002",
    "Eversys Cameo c'2s SN: 0099820025259C0040, Bunn ITCB-DV",
    "Bunn TB3\nSnapchill-2",
    "Bunn TB3\nSN: TB3001\nSN: TB3002",
    "Bunn ITCB-DV, w/Flip Tray",
    // At most one serial per unit of the machine line it follows or ends.
    "Bunn TB3 SN: TB3001\nSN: TB3002",
    "Bunn TB3 SN: TB3001; SN: TB3002",
    "2 x Bunn TB3 SN: A1001\nSN: A1002\nSN: A1003",
    "Bunn TB3\nSN: TB3001\nSN: TB3002\nMazzer Mini Electronic",
    "Bunn TB3 SN: TB3001\nMazzer Mini Electronic\nSN: 2608789\nSN: 2608790",
    "SN: 123\nBunn TB3",
    "Bunn TB3 Snapchill-2",
    "Bunn TB3 SNX-1000",
    "Bunn TB3 Serializer2",
    // Serial lines after a comma line belong to its last machine.
    "Bunn TB3, Mazzer Mini Electronic SN: 1001\nSN: 1002",
    "Bunn TB3, Mazzer Mini Electronic\nSN: 1001\nSN: 1002",
    "2 x Bunn TB3, Mazzer Mini Electronic SN: 1001\nSN: 1002\nSN: 1003",
    // A serial has at least three digits, so a word or a count after SN is not one.
    "Bunn TB3 SN2GO",
    "Bunn TB3 SN x2",
    "Bunn TB3 S/N 2-units",
    "Bunn TB3 SN 2pcs",
    "Bunn TB3 SN qty2",
    "Bunn TB3 S/N 1of2",
    "Bunn TB3 S/N2",
    "Bunn TB3\nSN: 2",
    "Bunn TB3 Serial # 2each",
    // A catalog model after SN is a machine, not a serial.
    "Bunn TB3 SN CBS-1231",
    "Bunn TB3\nSN CBS-1232",
    "Bunn TB3 SN51H-15",
  ]) {
    assert.equal(exact(text), null, text);
  }
});

test("install: spellings ignore filler on every model, a lone generic word is never one, and any longer name is a clash", () => {
  const catalog = [...realCatalog, "Acme The Grinder", "Bunn Grinder", 'Bunn X 29" Tall', "Bunn X 29", "Bunn Y 7 Brewer Set"];
  assert.equal(descriptionNames("The Grinder", ["Bunn Grinder"], catalog), false);
  assert.equal(descriptionNames("Install grinder", ["Bunn Grinder"], catalog), false);
  assert.equal(descriptionNames("Install Bunn Grinder", ["Bunn Grinder"], catalog), true);
  assert.equal(descriptionNames("Install Bunn X 29", ["Bunn X 29"], catalog), false);
  assert.equal(descriptionNames("Install Bunn Y 7 Brewer Set", ["Bunn Y 7 Brewer Set"], catalog), true);
});

test("install: a loosely written install never matches, by the problem description or by the Equipment column", async () => {
  const sql = await freshDb();
  await sql.query("insert into directory_equipment (name) select unnest($1::text[])", [realCatalog]);
  const ids = {
    a: await openInstall(sql, "Cafe Able", { equipment: "Bunn TB3 x2" }),
    b: await openInstall(sql, "Cafe Baker", { equipment: "TB3 / ITCB" }),
    c: await openInstall(sql, "Cafe Charlie", { machines: ["Linea Mini w/ Mazzer Mini"] }),
    d: await openInstall(sql, "Cafe Dog", { equipment: "Bunn CWTF15-TC" }),
    e: await openInstall(sql, "Cafe Echo", { equipment: "Cameo" }),
    f: await openInstall(sql, "Cafe Fox", { equipment: "TB3" }),
    g: await openInstall(sql, "Cafe Golf", { equipment: "BUNN ICB-DV, TALL" }),
    h: await openInstall(sql, "Cafe Hotel", { equipment: "Bunn TB3" }),
    i: await openInstall(sql, "Cafe India", { equipment: "Eversys Cameo c'2s" }),
    j: await openInstall(sql, "Cafe Juliet", { equipment: "La Marzocco Linea Mini" }),
    k: await openInstall(sql, "Cafe Kilo", { equipment: "Mazzer Mini Electronic SN:2608789, Mazzer Robur S Electronic SN:2601514" }),
    l: await openInstall(sql, "Cafe Lima", { machines: ["Bunn TB3 SN: TB3001", "S/N TB3002"] }),
  };
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Problem Description", "Equipment"],
    ["0681", "Work Started", "Cafe Able", "Install", "Install Bunn TB3", ""],
    ["0682", "Work Started", "Cafe Baker", "Install", 'Install Bunn ITCB-DV, 29" w/Flip Tray', ""],
    ["0683", "Work Started", "Cafe Charlie", "Install", "Install La Marzocco Linea Mini", ""],
    ["0684", "Work Started", "Cafe Dog", "Install", "", "Bunn CWTF TWIN-APS"],
    ["0685", "Work Started", "Cafe Echo", "Install", "", "Eversys Cameo c'2s"],
    ["0686", "Work Started", "Cafe Fox", "Install", "Install Bunn TB3", ""],
    // The Equipment column is read as exactly as the install.
    ["0687", "Work Started", "Cafe Golf", "Install", "", "ICB-DV Short"],
    ["0688", "Work Started", "Cafe Hotel", "Install", "", "Bunn TB3 x2"],
    ["0689", "Work Started", "Cafe India", "Install", "", "Cameo"],
    ["0690", "Work Started", "Cafe Juliet", "Install", "", "Linea Mini w/ Mazzer Mini"],
    ["0691", "Work Started", "Cafe Kilo", "Install", "Install Mazzer Mini Electronic", ""],
    ["0692", "Work Started", "Cafe Kilo", "Install", "", "Mazzer Robur S Electronic, Mazzer Mini Electronic"],
    // A saved machine row that is only a serial is a unit with no name.
    ["0693", "Work Started", "Cafe Lima", "Install", "", "Bunn TB3"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const only = (id) => `install #${id} is the account's only open install`;
  // A loose install (or a loose Equipment column) is never matched by equipment, and never read as different either:
  // the account's one open install is preselected, not by equipment.
  assert.deepEqual(
    preview.rows.map((r) => [r.wo, r.action, r.jobId, r.byEquipment, r.matchNote]),
    [
      ["WO-0681", "update", ids.a, false, only(ids.a)],
      ["WO-0682", "update", ids.b, false, only(ids.b)],
      ["WO-0683", "update", ids.c, false, only(ids.c)],
      ["WO-0684", "update", ids.d, false, only(ids.d)],
      ["WO-0685", "update", ids.e, false, only(ids.e)],
      ["WO-0686", "update", ids.f, true, `install #${ids.f} matched by account and equipment`],
      ["WO-0687", "create", null, false, `equipment differs from install #${ids.g}`],
      ["WO-0688", "update", ids.h, false, only(ids.h)],
      ["WO-0689", "update", ids.i, false, only(ids.i)],
      ["WO-0690", "update", ids.j, false, only(ids.j)],
      ["WO-0691", "create", null, false, `the problem description doesn't name install #${ids.k}'s equipment`],
      ["WO-0692", "update", ids.k, true, `install #${ids.k} matched by account and equipment`],
      ["WO-0693", "update", ids.l, false, only(ids.l)],
    ],
  );
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [11, 2]);
  for (const [id, wo] of [[ids.a, "WO-0681"], [ids.b, "WO-0682"], [ids.c, "WO-0683"], [ids.d, "WO-0684"], [ids.e, "WO-0685"]]) {
    assert.equal((await sql.query("select wo from installs where id = $1", [id]))[0].wo, wo);
  }
});
