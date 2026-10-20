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
const { namedMachines, parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
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

test("install: with no equipment column the machines are read from the problem description against the catalog", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Echo", { equipment: "Bunn ITCB 120v SN:ITCB064919" });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "Problem Description"],
    ["1002", "Completed", "Cafe Echo", "New install of Bunn ITCB brewer"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual([preview.rows[0].action, preview.rows[0].jobId, preview.rows[0].newStatus], ["update", id, "Installed"]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual(await installsOf(sql, "Cafe Echo"), [{ id, wo: "WO-1002", equip_status: "Installed" }]);
});

test("install: no equipment named, different equipment, a different quantity or two open installs open a new install and say why", async () => {
  const sql = await installDesk();
  const foxtrot = await openInstall(sql, "Cafe Foxtrot", { machines: ["Eversys e'4m"] });
  const golf = await openInstall(sql, "Cafe Golf", { machines: ["Eversys e'4m"] });
  const hotel = await openInstall(sql, "Cafe Hotel", { machines: ["Bunn ITCB"] });
  await openInstall(sql, "Cafe India", { machines: ["Eversys e'4m"] });
  await openInstall(sql, "Cafe India", { machines: ["Eversys e'4m"] });
  await openInstall(sql, "Cafe Kilo", { machines: ["Eversys e'4m"], wo: "WO-0042" });
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
      ["create", null, "no equipment named to match an install"],
      ["create", null, `equipment differs from install #${golf}`],
      ["create", null, `equipment differs from install #${hotel}`],
      ["create", null, "two installs could match"],
      ["create", null, null],
    ],
  );
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual((await installsOf(sql, "Cafe Foxtrot")).map((r) => [r.id === foxtrot, r.wo]), [[true, null], [false, "WO-1003"]]);
  assert.equal((await installsOf(sql, "Cafe India")).filter((r) => r.wo === "WO-1006").length, 1);
  assert.equal((await installsOf(sql, "Cafe India")).filter((r) => !r.wo).length, 2);
});

test("install: two rows for one open install — the first attaches, the next opens a new install, in one chunk or across chunks", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Juliet", { machines: ["Eversys e'4m"] });
  const { records } = parseCorrigoMatrix([
    ["ST#", "Customer Name", "P.O. #", "Equipment"],
    ["1101", "Cafe Juliet", "Install", "Eversys e'4m"],
    ["1102", "Cafe Juliet", "Install", "Eversys e'4m"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.deepEqual(preview.rows.map((r) => [r.action, r.jobId]), [["update", id], ["create", null]]);
  assert.equal(preview.rows[1].matchNote, `install #${id} already matched by an earlier row`);
  const later = await previewCorrigoRecords(sql, records.slice(1), [id]);
  assert.deepEqual([later.rows[0].action, later.rows[0].matchNote], ["create", `install #${id} already matched by an earlier row`]);
  const ui = readFileSync(new URL("../src/components/desk/corrigo-import.tsx", import.meta.url), "utf8");
  assert.match(ui, /previewCorrigoImport\(\{ data: \{ records, claimedInstalls: \[\.\.\.claimedInstalls\] \} \}\)/);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual((await installsOf(sql, "Cafe Juliet")).map((r) => [r.id === id, r.wo]), [[true, "WO-1101"], [false, "WO-1102"]]);
});

test("install: an install given another WO after the preview is not overwritten — apply opens a new one", async () => {
  const sql = await installDesk();
  const id = await openInstall(sql, "Cafe Lima", { machines: ["Bunn ITCB"] });
  const { records } = parseCorrigoMatrix([["ST#", "Customer Name", "P.O. #", "Equipment"], ["1201", "Cafe Lima", "Install", "Bunn ITCB"]]);
  const preview = await previewCorrigoRecords(sql, records);
  assert.equal(preview.rows[0].jobId, id);
  await sql.query("update installs set wo = 'WO-5555' where id = $1", [id]);
  await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual((await installsOf(sql, "Cafe Lima")).map((r) => [r.id === id, r.wo]), [[true, "WO-5555"], [false, "WO-1201"]]);
});

// Review fixes: real catalog spellings, a wrapped desk with both cycles of one number, and apply races.

test("install: free text finds machines spelled as the real catalog spells them, and plain words name nothing", () => {
  const cameo = "Eversys Cameo c'2s - 2 Step Classic";
  assert.deepEqual(namedMachines("Install Eversys Cameo c'2s", realCatalog, true), [cameo]);
  assert.deepEqual(namedMachines("New install of Bunn ITCB brewer", realCatalog, true), ['Bunn ITCB-DV, 29" w/Flip Tray']);
  assert.deepEqual(namedMachines("Install new Cameo c'2s", realCatalog, true), [cameo]);
  for (const words of ["Install", "Set up", "Installation follow-up", "Brewer"]) {
    assert.deepEqual(namedMachines(words, realCatalog, true), [], words);
  }
});

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
    ["0664", "Work Started", "Cafe November", "", "New install of Bunn ITCB brewer"],
    ["0665", "Work Started", "Cafe Oscar", "", "Install new Cameo c'2s; Bunn ITCB"],
    ["0666", "Work Started", "Cafe Papa", "Install", "Install"],
    ["0667", "Work Started", "Cafe Quebec", "Install", "Set up"],
    ["0668", "Work Started", "Cafe Romeo", "Install", "Brewer"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const none = "no equipment named to match an install";
  assert.deepEqual(
    preview.rows.map((r) => [r.wo, r.action, r.jobId, r.matchNote]),
    [
      ["WO-0663", "update", mike, `install #${mike} matched by account and equipment`],
      ["WO-0664", "update", november, `install #${november} matched by account and equipment`],
      ["WO-0665", "update", oscar, `install #${oscar} matched by account and equipment`],
      ["WO-0666", "create", null, none],
      ["WO-0667", "create", null, none],
      ["WO-0668", "create", null, none],
    ],
  );
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [3, 3]);
  for (const [id, wo] of [[mike, "WO-0663"], [november, "WO-0664"], [oscar, "WO-0665"]]) {
    assert.equal((await sql.query("select wo from installs where id = $1", [id]))[0].wo, wo);
  }
  for (const id of [papa, quebec, romeo]) assert.equal((await sql.query("select wo from installs where id = $1", [id]))[0].wo, null);
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

// N1: free text (problem description, then work done) names machines only when it reads cleanly; otherwise none.

test("install: free text counts a name only with a model code, pins each name to one catalog model, and otherwise names none", () => {
  const cameo = "Eversys Cameo c'2s - 2 Step Classic";
  const itcb = 'Bunn ITCB-DV, 29" w/Flip Tray';
  const g92tHd = "Bunn G9-2T HD Dual Portion Grinder";
  const named = (text) => namedMachines(text, realCatalog, true);
  // Plain words in the work done add nothing; the problem description's machine stands.
  assert.deepEqual(named(["Install Eversys Cameo c'2s", "Installed machine and trained staff."]), [cameo]);
  for (const words of [
    "Install new machine",
    "Remove old machine and install new Linea Mini",
    "Install espresso machine",
    "Install water filter",
    "Install flip tray",
    "Install 1.5 gallon brewer",
    "Install 1 group",
    "Install single hopper grinder",
    "Installed machine and trained staff.",
    "Set up machine and trained staff",
  ]) {
    assert.deepEqual(named(words), [], words);
  }
  // Two machines that each read as one model are both named.
  assert.deepEqual(named("Install Bunn ITCB and G9-2T HD grinder"), [itcb, g92tHd]);
  // A name with a brand or model word that fits several models (or none) leaves the whole text naming nothing.
  for (const text of [
    "Install new Cameo c'2s and Bunn Axiom",
    "Install Bunn ITCB and Bunn G9-2T",
    "Install Bunn ITCB and Bunn Axiom-APS",
    "Install Eversys Cameo c'2s and Linea Mini",
    "Install Cameo",
    "Install Bunn brewer",
  ]) {
    assert.deepEqual(named(text), [], text);
  }
  // A quantity anywhere but a leading "N x" on its own line leaves the whole text naming nothing.
  for (const text of [
    "Install 2 x Eversys Cameo c'2s",
    "Install 2 Eversys Cameo c'2s",
    "Install two Eversys Cameo c'2s",
    "Install Eversys Cameo c'2s x2",
    "Install Bunn ITCB (2)",
    "Install Bunn ITCB, qty 2",
    "2 x Bunn ITCB and Bunn TB3",
  ]) {
    assert.deepEqual(named(text), [], text);
  }
  assert.deepEqual(named("2 x Bunn ITCB\nBunn TB3"), [itcb, itcb, "Bunn TB3"]);
  // Work done is read only when the problem description names nothing; when both name machines they must agree.
  assert.deepEqual(named(["Install", "Installed Bunn ITCB"]), [itcb]);
  assert.deepEqual(named(["Install Eversys Cameo c'2s", "Installed Cameo c'2s, trained 3 staff"]), [cameo]);
  assert.deepEqual(named(["Install Eversys Cameo c'2s", "Installed Bunn ITCB"]), []);
  assert.deepEqual(named(["Install Eversys Cameo c'2s", "Installed 2 x Cameo c'2s"]), []);
  assert.deepEqual(named(["Install Bunn Axiom", "Installed Bunn ITCB"]), []);
});

test("install: with the real catalog, free text attaches only on a clean read of the install's package (WO-0665, WO-0666)", async () => {
  const sql = await freshDb();
  await sql.query("insert into directory_equipment (name) select unnest($1::text[])", [realCatalog]);
  const ids = {
    a: await openInstall(sql, "Cafe Alpha", { equipment: "Eversys Cameo c'2s" }),
    b: await openInstall(sql, "Cafe Bravo", { equipment: "Eversys Cameo c'2s" }),
    c: await openInstall(sql, "Cafe Charlie", { equipment: "Bunn ITCB" }),
    d: await openInstall(sql, "Cafe Dakota", { equipment: "Eversys Cameo c'2s" }),
    e: await openInstall(sql, "Cafe Easy", { equipment: "La Marzocco Linea Mini" }),
    f: await openInstall(sql, "Cafe Fox", { equipment: "Bunn ITCB" }),
  };
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Problem Description", "Work Done", "Date/Time Completed"],
    ["0665", "Completed", "Cafe Alpha", "Install", "Install Eversys Cameo c'2s", "Installed machine and trained staff.", "10/19/2026"],
    ["0666", "Work Started", "Cafe Bravo", "Install", "Install 2 x Eversys Cameo c'2s", "", ""],
    ["0667", "Work Started", "Cafe Charlie", "Install", "Install Bunn ITCB and G9-2T HD grinder", "", ""],
    ["0668", "Work Started", "Cafe Dakota", "Install", "Install new Cameo c'2s and Bunn Axiom", "", ""],
    ["0669", "Work Started", "Cafe Easy", "Install", "Remove old machine and install new Linea Mini", "", ""],
    ["0670", "Work Started", "Cafe Fox", "Install", "Install new machine", "", ""],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const none = "no equipment named to match an install";
  assert.deepEqual(
    preview.rows.map((r) => [r.wo, r.action, r.jobId, r.byEquipment, r.matchNote]),
    [
      ["WO-0665", "update", ids.a, true, `install #${ids.a} matched by account and equipment`],
      ["WO-0666", "create", null, false, none],
      ["WO-0667", "create", null, false, `equipment differs from install #${ids.c}`],
      ["WO-0668", "create", null, false, none],
      ["WO-0669", "create", null, false, none],
      ["WO-0670", "create", null, false, none],
    ],
  );
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.deepEqual([res.updated, res.created], [1, 5]);
  assert.deepEqual(await installsOf(sql, "Cafe Alpha"), [{ id: ids.a, wo: "WO-0665", equip_status: "Installed" }]);
  for (const [customer, id, wo] of [
    ["Cafe Bravo", ids.b, "WO-0666"],
    ["Cafe Charlie", ids.c, "WO-0667"],
    ["Cafe Dakota", ids.d, "WO-0668"],
    ["Cafe Easy", ids.e, "WO-0669"],
    ["Cafe Fox", ids.f, "WO-0670"],
  ]) {
    assert.deepEqual((await installsOf(sql, customer)).map((r) => [r.id === id, r.wo]), [[true, null], [false, wo]], customer);
  }
});
