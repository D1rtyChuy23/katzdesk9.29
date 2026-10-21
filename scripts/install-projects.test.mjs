// Install projects, Chuy 10/21: one install carries several Corrigo work orders (Baldi: WO-0831, WO-0855, ...), the
// import's install picker, the looser customer match for install candidates, merging installs, and the install's
// customer (changing it, the owner's lock).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { parseCorrigoMatrix, settleInstallRows } = await import("../src/lib/ops/corrigo.ts");
const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
const { customersLooselyMatch } = await import("../src/lib/ops/clean-names.ts");
const { findWoEverywhere, withWoMatches } = await import("../src/lib/ops/wo-search.ts");
const { addInstallWorkOrderFor, loadInstallWos, removeInstallWorkOrderFor } = await import("../src/lib/ops/install-work-orders.ts");
const { mergeInstallsFor, mergedMachineList, setInstallCustomerLockFor } = await import("../src/lib/ops/install-projects.ts");
const { syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const api = await import("../src/lib/ops/api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh({ upTo } = {}) {
  const pg = new PGlite();
  for (const name of files) {
    if (upTo && name >= upTo) break;
    await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  }
  if (!upTo) {
    await pg.query("insert into directory_equipment (name) values ('Eversys e''4m'), ('Mahlkonig E65S'), ('Bunn ITCB'), ('Bunn TB3')");
    // Chuy is the owner (roster admin) and an admin; Melinda is a teammate.
    await pg.query(
      "insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy', true, true), ('u-tech', 'melinda', true, false)",
    );
  }
  const query = async (text, params) => (await pg.query(text, params)).rows;
  // api.ts writes tagged templates; the rest of the app calls sql.query.
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const install = async (sql, customer, { machines = null, wo = null, status = "Not Ready", notes = null } = {}) =>
  (
    await sql.query(
      "insert into installs (customer, equipment, machines, wo, equip_status, notes) values ($1, $2, $3, $4, $5, $6) returning id",
      [
        customer,
        machines ? machines.map((m) => m.equipment ?? m).join("\n") : null,
        machines ? JSON.stringify(machines.map((m) => (typeof m === "string" ? { equipment: m, serial: "", powerVoltage: "" } : m))) : null,
        wo,
        status,
        notes,
      ],
    )
  )[0].id;
const installRow = async (sql, id) =>
  (await sql.query("select id, customer, wo, equip_status, complete, archived, duplicate_of, notes, machines from installs where id = $1", [id]))[0];
const wosOf = async (sql, id) =>
  (await sql.query("select wo, status from install_work_orders where install_id = $1 order by id", [id])).map((r) => [r.wo, r.status]);
const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment", "Problem Description", "Date/Time Completed"], ...rows]).records;

test("customer match for install candidates: core words or their first words, never one generic word", () => {
  for (const [a, b] of [
    ["Baldi Management", "Baldi Management Group Inc."],
    ["Baldi Management Group, Inc", "baldi management"],
    ["The Baldi Group", "Baldi"],
    ["Cafe Delta LLC", "CAFE DELTA"],
    ["Acme Coffee Co.", "Acme Coffee Company"],
  ]) {
    assert.equal(customersLooselyMatch(a, b), true, `${a} ~ ${b}`);
  }
  for (const [a, b] of [
    ["Baldi Management", "Management Baldi"],
    ["Coffee Co", "The Coffee Company House"],
    ["Cafe", "Cafe Delta"],
    ["Baldi Management", "Baldi Holdings"],
    ["Walk-In", "Walk-In"],
    ["", "Baldi"],
  ]) {
    assert.equal(customersLooselyMatch(a, b), false, `${a} !~ ${b}`);
  }
});

test("migration 0093 gives every install's WO its first work-order row", async () => {
  const { pg } = await fresh({ upTo: "0093" });
  try {
    await pg.query("insert into installs (customer, wo, complete, completed_at) values ('A', 'WO-0855', true, '2026-10-01'), ('B', ' ', false, null), ('C', 'wo 0042', false, null)");
    await pg.exec(readFileSync(new URL("0093_install_work_orders.sql", MIGRATIONS), "utf8"));
    const rows = (await pg.query("select install_id, wo, match_key, status, completed_at::text as d from install_work_orders order by install_id")).rows;
    assert.deepEqual(rows, [
      { install_id: 1, wo: "WO-0855", match_key: "855", status: "Completed", d: "2026-10-01" },
      { install_id: 3, wo: "wo 0042", match_key: "42", status: null, d: null },
    ]);
  } finally {
    await pg.close();
  }
});

test("Baldi: two Corrigo WOs for 'Baldi Management' both go on the open install as one project, Installed once both are completed", async () => {
  const { pg, sql } = await fresh();
  try {
    const baldi = await install(sql, "Baldi Management Group Inc.", { machines: ["Eversys e'4m"] });
    const records = file([
      ["0831", "Completed", "Baldi Management", "Install", "", "Install", "10/19/2026"],
      ["0855", "Work Started", "Baldi Management", "Install", "", "Install day 2", ""],
    ]);
    const preview = await previewCorrigoRecords(sql, records);
    assert.deepEqual(
      preview.rows.map((r) => [r.wo, r.action, r.jobId, r.byAccount, r.installChoice, r.customer, r.fileCustomer]),
      [
        ["WO-0831", "update", baldi, true, baldi, "Baldi Management Group Inc.", "Baldi Management"],
        ["WO-0855", "update", baldi, true, baldi, "Baldi Management Group Inc.", "Baldi Management"],
      ],
    );
    assert.deepEqual(preview.rows[0].installOptions.map((o) => o.label), [
      `Attach to install #${baldi} · Eversys e'4m · Not Ready · no WO yet`,
      "Create new install",
    ]);
    // The second row's picker shows WO-0831 already on the install: it goes on as another work order.
    assert.equal(preview.rows[1].installOptions[0].label, `Attach to install #${baldi} · Eversys e'4m · Not Ready · WO-0831`);
    // WO-0831 is completed, WO-0855 isn't: the project isn't installed, and the preview says so.
    assert.deepEqual(preview.rows.map((r) => [r.oldStatus, r.newStatus]), [["Not Ready", "Not Ready"], ["Not Ready", "Ready"]]);
    assert.equal(preview.rows[0].statusNote, "1 of 2 work orders completed → keeps Not Ready");
    const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
    assert.deepEqual([res.updated, res.created], [2, 0]);
    assert.equal((await sql.query("select count(*)::int as n from installs"))[0].n, 1);
    const row = await installRow(sql, baldi);
    assert.deepEqual([row.customer, row.wo, row.equip_status, row.complete], ["Baldi Management Group Inc.", "WO-0831", "Ready", false]);
    assert.deepEqual(await wosOf(sql, baldi), [["WO-0831", "Completed"], ["WO-0855", "Work Started"]]);
    // For Review names the install the WO went on.
    assert.equal(res.review.find((r) => r.id === baldi).note, `WO-0831 added to install #${baldi} with WO-0855`);

    // The next file: WO-0855 completed too. It finds the install by that WO, and the project is Installed.
    const done = await previewCorrigoRecords(sql, file([["0855", "Completed", "Baldi Management", "Install", "", "", "10/20/2026"]]));
    assert.deepEqual([done.rows[0].action, done.rows[0].jobId, done.rows[0].byAccount, done.rows[0].newStatus], ["update", baldi, false, "Installed"]);
    await applyCorrigoRows(sql, done.rows, "Chuy");
    assert.deepEqual(
      [(await installRow(sql, baldi)).equip_status, (await installRow(sql, baldi)).complete],
      ["Installed", true],
    );
    assert.equal((await sql.query("select to_char(completed_at, 'YYYY-MM-DD') as d from installs where id = $1", [baldi]))[0].d, "2026-10-20");
  } finally {
    await pg.close();
  }
});

test("Baldi: a third WO later attaches to the open project too, and the top search and findWoEverywhere find it by WO-0855", async () => {
  const { pg, sql } = await fresh();
  try {
    const baldi = await install(sql, "Baldi Management Group Inc.");
    await applyCorrigoRows(sql, (await previewCorrigoRecords(sql, file([
      ["0831", "Work Started", "Baldi Management", "Install", "", "", ""],
      ["0855", "Work Started", "Baldi Management", "Install", "", "", ""],
    ]))).rows, "Chuy");
    const third = await previewCorrigoRecords(sql, file([["0902", "Picked Up", "BALDI MANAGEMENT GROUP", "Install", "", "", ""]]));
    assert.deepEqual([third.rows[0].action, third.rows[0].jobId], ["update", baldi]);
    assert.equal(third.rows[0].installOptions[0].label, `Attach to install #${baldi} · no equipment listed · Ready · WO-0831, WO-0855`);
    await applyCorrigoRows(sql, third.rows, "Chuy");
    assert.deepEqual((await wosOf(sql, baldi)).map(([wo]) => wo), ["WO-0831", "WO-0855", "WO-0902"]);

    const everywhere = await findWoEverywhere(sql, "855");
    assert.deepEqual(everywhere.map((h) => [h.entityType, h.id, h.wo]), [["install", baldi, "WO-0855"]]);
    const hits = await api.searchAllFor(sql, { q: "WO-0855" }, { userId: "u-owner" });
    assert.deepEqual(hits.filter((h) => h.entityType === "install").map((h) => [h.id, h.subtitle]), [[baldi, "WO-0855 · Installs · Ready"]]);
    const text = await api.searchAllFor(sql, { q: "0902" }, { userId: "u-owner" });
    assert.ok(text.some((h) => h.entityType === "install" && h.id === baldi));
    // The Installs list (and any board using withWoMatches) finds it by any of its WOs.
    const listed = [{ id: baldi, wo: "WO-0831", workOrders: (await loadInstallWos(sql, [baldi])).get(baldi) }, { id: 99, wo: null, workOrders: [] }];
    assert.deepEqual(withWoMatches([], listed, "wo 902").map((r) => r.id), [baldi]);
    // listInstalls hands the board every WO.
    const board = (await api.updateInstallFor(sql, { id: baldi, notes: "day 3" }, { userId: "u-owner" })).workOrders;
    assert.deepEqual(board.map((w) => [w.wo, w.primary]), [["WO-0831", true], ["WO-0855", false], ["WO-0902", false]]);
  } finally {
    await pg.close();
  }
});

test("install picker: different named equipment preselects Create new; two open installs preselect Create new with both listed", async () => {
  const { pg, sql } = await fresh();
  try {
    const delta = await install(sql, "Cafe Delta Inc.", { machines: ["Bunn ITCB"] });
    const e1 = await install(sql, "Cafe Echo", { machines: ["Bunn TB3"] });
    const e2 = await install(sql, "Cafe Echo LLC", { machines: ["Eversys e'4m"], wo: "WO-0700" });
    const preview = await previewCorrigoRecords(sql, file([
      ["1001", "Work Started", "Cafe Delta", "Install", "Eversys e'4m", "", ""],
      ["1002", "Work Started", "Cafe Echo", "Install", "", "", ""],
    ]));
    assert.deepEqual(
      preview.rows.map((r) => [r.action, r.installChoice, r.installOptions.map((o) => o.id), r.matchNote]),
      [
        ["create", null, [delta, null], `equipment differs from install #${delta}`],
        ["create", null, [e1, e2, null], "two installs could match"],
      ],
    );
    // A candidate can still be chosen: the row then attaches, and the import writes what the preview shows.
    // Create new (null) chosen on a preselected row sticks: a draft's null is a choice, only an unset one preselects.
    const ui = readFileSync(new URL("../src/components/desk/corrigo-import.tsx", import.meta.url), "utf8");
    assert.match(ui, /\(r\) => drafts\[rowKey\(r\)\]\?\.installChoice,/);
    assert.match(ui, /installChoice\?: number \| null;/);
    const picked = settleInstallRows(preview.rows, (r) => (r.wo === "WO-1002" ? e2 : r.installChoice));
    assert.deepEqual([picked[1].action, picked[1].jobId, picked[1].customer, picked[1].oldStatus], ["update", e2, "Cafe Echo LLC", "Not Ready"]);
    const res = await applyCorrigoRows(sql, picked, "Chuy");
    assert.deepEqual([res.updated, res.created], [1, 1]);
    assert.deepEqual((await wosOf(sql, e2)).map(([wo]) => wo), ["WO-0700", "WO-1002"]);
    assert.equal((await installRow(sql, delta)).wo, null);
    // At apply, a picked install that went to another account since the preview gets a new install instead.
    const fox = await install(sql, "Cafe Fox Inc.");
    const again = await previewCorrigoRecords(sql, file([["1003", "Work Started", "Cafe Fox", "Install", "", "", ""]]));
    assert.equal(again.rows[0].jobId, fox);
    await sql.query("update installs set customer = 'Other Place' where id = $1", [fox]);
    const late = await applyCorrigoRows(sql, again.rows, "Chuy");
    assert.deepEqual([late.updated, late.created], [0, 1]);
  } finally {
    await pg.close();
  }
});

test("install window: add a WO, remove one; removing the primary promotes the next", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Foxtrot", { wo: "WO-0500" });
    await sql.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-1', 'Cafe Foxtrot', 'WO-0501', 'Open')");
    const added = await addInstallWorkOrderFor(sql, "u-tech", { installId: id, wo: "501" });
    assert.deepEqual(added.workOrders.map((w) => [w.wo, w.primary]), [["WO-0500", true], ["WO-0501", false]]);
    assert.deepEqual(added.alsoOn.map((h) => h.entityType), ["service"]);
    await assert.rejects(() => addInstallWorkOrderFor(sql, "u-tech", { installId: id, wo: "wo-0501" }), /already on this install/);
    const removed = await removeInstallWorkOrderFor(sql, "u-tech", { installId: id, matchKey: "500" });
    assert.equal(removed.primary, "WO-0501");
    assert.equal((await installRow(sql, id)).wo, "WO-0501");
    const last = await removeInstallWorkOrderFor(sql, "u-tech", { installId: id, matchKey: "501" });
    assert.deepEqual([last.primary, last.workOrders], [null, []]);
    assert.equal((await installRow(sql, id)).wo, null);
    // The window's WO # field still edits the primary, and its row follows.
    await api.updateInstallFor(sql, { id, wo: "WO-0600" }, { userId: "u-tech" });
    await api.updateInstallFor(sql, { id, wo: "WO-0601" }, { userId: "u-tech" });
    assert.deepEqual((await wosOf(sql, id)).map(([wo]) => wo), ["WO-0601"]);
  } finally {
    await pg.close();
  }
});

test("merge: the drop's WOs, missing machine rows, notes, activity and new visit units move to the keeper; nothing is deleted", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Baldi Management Group Inc.", {
      machines: [{ equipment: "Eversys e'4m", serial: "E-1", powerVoltage: "208v" }],
      wo: "WO-0831",
      notes: "Back door",
    });
    const drop = await install(sql, "Baldi Management", {
      machines: [
        { equipment: "Eversys e'4m", serial: "E-1", powerVoltage: "" },
        { equipment: "Mahlkonig E65S", serial: "M-9", powerVoltage: "120v", ownership: "Sold" },
      ],
      wo: "WO-0855",
      notes: "Call Joe",
    });
    await sql.query("insert into install_work_orders (install_id, wo, match_key, status) values ($1, 'WO-0831', '831', null), ($2, 'WO-0855', '855', 'Completed'), ($2, 'WO-0831', '831', 'Completed')", [keep, drop]);
    await syncInstallUnits(sql, keep);
    await syncInstallUnits(sql, drop);
    const units = await sql.query("select id, customer, equipment_name, serial, created_by_install from account_equipment order by id");
    const grinder = units.find((u) => u.serial === "M-9");
    const dropMachine = units.find((u) => u.customer === "Baldi Management" && u.serial === "E-1");
    await sql.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, $2, 'power', 'data:x')", [drop, grinder.id]);
    await sql.query("insert into comments (entity_type, entity_id, author_name, body) values ('install', $1, 'chuy', 'drop note')", [drop]);
    const before = (await sql.query("select count(*)::int as n from account_equipment"))[0].n;

    await assert.rejects(() => mergeInstallsFor(sql, "u-tech", { keepId: keep, dropId: drop }), /Only an Admin/);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: keep }), /another install/);
    const out = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.deepEqual([out.workOrders, out.machines], [1, 1]);

    const k = await installRow(sql, keep);
    assert.deepEqual(JSON.parse(k.machines).map((m) => [m.equipment, m.serial, m.powerVoltage, m.ownership ?? null]), [
      ["Eversys e'4m", "E-1", "208v", null],
      ["Mahlkonig E65S", "M-9", "120v", "Sold"],
    ]);
    assert.equal(k.notes, `Back door\n\nFrom install #${drop}: Call Joe`);
    assert.deepEqual(await wosOf(sql, keep), [["WO-0831", null], ["WO-0855", "Completed"]]);
    const d = await installRow(sql, drop);
    assert.deepEqual([d.archived, d.duplicate_of], [true, keep]);
    // The grinder (no twin on the keeper) moved with its photo; the drop's e'4m has a twin, so it stays on the drop.
    const links = await sql.query("select install_id, equipment_id from install_inspection_units order by install_id, equipment_id");
    assert.ok(links.some((l) => l.install_id === keep && l.equipment_id === grinder.id));
    assert.ok(links.some((l) => l.install_id === drop && l.equipment_id === dropMachine.id));
    assert.deepEqual((await sql.query("select install_id from install_inspection_photos where equipment_id = $1", [grinder.id])).map((r) => r.install_id), [keep]);
    const moved = (await sql.query("select customer, created_by_install from account_equipment where id = $1", [grinder.id]))[0];
    assert.deepEqual(moved, { customer: "Baldi Management Group Inc.", created_by_install: keep });
    assert.equal((await sql.query("select count(*)::int as n from account_equipment"))[0].n, before);
    assert.equal((await sql.query("select entity_id from comments where body = 'drop note'"))[0].entity_id, keep);
    const logs = await sql.query("select entity_id, detail from activity where action = 'merged' order by id");
    assert.deepEqual(logs.map((l) => l.entity_id), [keep, drop]);
    assert.match(logs[0].detail, new RegExp(`merged install #${drop} · WO-0855`));
    // WO-0855 now finds the keeper only.
    assert.deepEqual((await findWoEverywhere(sql, "855")).map((h) => h.id), [keep]);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }), /archived/);
  } finally {
    await pg.close();
  }
});

test("merge: refused when a locked unit would have to change account, or the installs are on two accounts", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Golf Inc.", { machines: ["Bunn TB3"] });
    const drop = await install(sql, "Cafe Golf", { machines: ["Bunn ITCB"] });
    const other = await install(sql, "Hotel Icon", { machines: ["Bunn ITCB"] });
    await syncInstallUnits(sql, drop);
    await sql.query("update account_equipment set locked_at = now(), locked_by = 'chuy' where customer = 'Cafe Golf'");
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }), /Locked by chuy\. Only chuy can unlock it\./);
    assert.equal((await installRow(sql, drop)).archived, false);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: other }), /another account/);
  } finally {
    await pg.close();
  }
});

test("merge: a drop row the keeper has (same model, a serial on one side) fills the keeper's blanks instead of adding a row", () => {
  const spec = (equipment, serial = "", powerVoltage = "") => ({ equipment, serial, powerVoltage });
  const { list, added } = mergedMachineList([spec("Bunn TB3"), spec("Bunn TB3", "T-2")], [spec("Bunn TB3", "T-1", "120v"), spec("Bunn TB3", "T-2"), spec("Bunn TB3", "T-3")]);
  assert.deepEqual(list.map((m) => [m.serial, m.powerVoltage]), [["T-1", "120v"], ["T-2", ""], ["T-3", ""]]);
  assert.equal(added.length, 1);
});

test("customer: anyone can change it, the install's own units go with it, and a locked customer is refused until the owner unlocks", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Baldi Management", { machines: [{ equipment: "Bunn TB3", serial: "T-1", powerVoltage: "" }, "Bunn ITCB", "Eversys e'4m"] });
    const other = await install(sql, "Baldi Management", { machines: ["Bunn ITCB"] });
    await syncInstallUnits(sql, id);
    const units = await sql.query("select id, equipment_name from account_equipment where created_by_install = $1 order by id", [id]);
    const itcb = units.find((u) => u.equipment_name === "Bunn ITCB");
    const e4m = units.find((u) => u.equipment_name === "Eversys e'4m");
    // The ITCB is on another install's visit too, and the e'4m is locked: both stay on the old account.
    await sql.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [other, itcb.id]);
    await sql.query("update account_equipment set locked_at = now(), locked_by = 'chuy' where id = $1", [e4m.id]);
    const saved = await api.updateInstallFor(sql, { id, customer: "Baldi Management Group Inc." }, { userId: "u-tech" });
    assert.equal(saved.customer, "Baldi Management Group Inc.");
    assert.deepEqual(saved.unitsMoved, { moved: ["Bunn TB3 SN T-1"], stayed: ["Bunn ITCB", "Eversys e'4m"] });
    assert.deepEqual(
      (await sql.query("select equipment_name, customer from account_equipment where created_by_install = $1 order by id", [id])).map((u) => [u.equipment_name, u.customer]),
      [["Bunn TB3", "Baldi Management Group Inc."], ["Bunn ITCB", "Baldi Management"], ["Eversys e'4m", "Baldi Management"]],
    );

    await assert.rejects(() => setInstallCustomerLockFor(sql, "u-tech", { id, locked: true }), /Only the owner/);
    const lock = await setInstallCustomerLockFor(sql, "u-owner", { id, locked: true });
    assert.equal(lock.customerLockedBy, "chuy");
    await assert.rejects(
      () => api.updateInstallFor(sql, { id, customer: "Somewhere Else" }, { userId: "u-tech" }),
      /Locked by chuy\. Only chuy can unlock it\./,
    );
    // The window's own save sends the same customer back: that is no change, so it saves.
    const same = await api.updateInstallFor(sql, { id, customer: "Baldi Management Group Inc.", notes: "ok" }, { userId: "u-tech" });
    assert.deepEqual([same.customer, same.customerLockedBy], ["Baldi Management Group Inc.", "chuy"]);
    // The Corrigo import doesn't rename a locked install either.
    const preview = await previewCorrigoRecords(sql, file([["0950", "Work Started", "Baldi Management", "Install", "", "", ""]]));
    const row = { ...preview.rows.find((r) => r.jobId === id), customer: "Baldi Mgmt" };
    await applyCorrigoRows(sql, [row], "Chuy");
    assert.equal((await installRow(sql, id)).customer, "Baldi Management Group Inc.");
    await setInstallCustomerLockFor(sql, "u-owner", { id, locked: false });
    assert.equal((await api.updateInstallFor(sql, { id, customer: "Somewhere Else" }, { userId: "u-tech" })).customer, "Somewhere Else");
  } finally {
    await pg.close();
  }
});

test("the install window shows the customer field, the owner's lock, the WO list and Merge", () => {
  const src = readFileSync(new URL("../src/components/desk/entity-sheets.tsx", import.meta.url), "utf8");
  const sheet = src.slice(src.indexOf("export function InstallSheet"), src.indexOf("function DealMachines"));
  assert.doesNotMatch(sheet, /<input type="hidden" name="customer"/);
  assert.match(sheet, /<InstallCustomerField/);
  assert.match(sheet, /<InstallWorkOrders/);
  assert.match(sheet, /<MergeInstall/);
});
