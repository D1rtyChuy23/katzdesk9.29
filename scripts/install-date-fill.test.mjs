// Equipment Install date from the install (Chuy, 11/18): a Corrigo install ticket completed (or an install marked
// Installed) fills each new unit's install date, from the install's completed date, or its scheduled date when that is
// blank. A date already set is kept, a Locked unit is never touched. Plus a one-time Admin backfill, preview then
// apply. The case copied: two Bunn ITCB-DV units (ITCB187083 / ITCB187074) on an install with a blank Install date.
// Made-up accounts and people.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
const { syncInstallUnits, readInspection, loadInspectionSummaries } = await import("../src/lib/ops/inspection-api.ts");
const F = await import("../src/lib/ops/install-date-fill.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const CUSTOMER = "ZZ Under The Radar";

async function fresh() {
  const pg = new PGlite();
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Bunn ITCB-DV'), ('Bunn TB3')");
  await pg.query("insert into directory_customers (name) values ($1)", [CUSTOMER]);
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy.zz', true, true), ('u-tech', 'tech.zz', true, false)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql, query };
}

/** An install with two Bunn ITCB-DV units on the account, linked through the install, install dates blank. */
async function bunnInstall(sql, query, extra = {}) {
  const machines = [
    { equipment: "Bunn ITCB-DV", serial: "ITCB187083", powerVoltage: "" },
    { equipment: "Bunn ITCB-DV", serial: "ITCB187074", powerVoltage: "" },
  ];
  const f = { customer: CUSTOMER, equipment: "Bunn ITCB-DV\nBunn ITCB-DV", machines: JSON.stringify(machines), equip_status: "Not Ready", wo: "WO-1150", ...extra };
  const cols = Object.keys(f);
  const id = Number((await query(`insert into installs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f)))[0].id);
  await syncInstallUnits(sql, id);
  return id;
}
const units = async (query) =>
  (await query("select id, serial, install_date::text as d, locked_at is not null as locked, ownership, part_number from account_equipment order by serial")).map((r) => ({ ...r }));
const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment", "Problem Description", "Date/Time Completed"], ...rows]).records;

test("a Corrigo install ticket completed fills each unit's install date from the completed date, and says so", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    assert.deepEqual((await units(query)).map((u) => [u.serial, u.d]), [["ITCB187074", null], ["ITCB187083", null]]);
    const preview = await previewCorrigoRecords(sql, file([["1150", "Completed", CUSTOMER, "Installation", "", "Install the brewers", "11/10/2026"]]));
    assert.deepEqual(preview.rows.map((r) => [r.board, r.action, r.jobId]), [["install", "update", id]]);
    await applyCorrigoRows(sql, preview.rows, "chuy.zz");
    assert.deepEqual((await units(query)).map((u) => [u.serial, u.d]), [["ITCB187074", "2026-11-10"], ["ITCB187083", "2026-11-10"]]);
    const log = (await query("select actor_name, detail from activity where entity_type = 'install' and entity_id = $1 and action = 'install-date'", [id]))[0];
    assert.equal(log.actor_name, "chuy.zz");
    assert.match(log.detail, /2026-11-10 \(the install's completed date\)/);
    assert.match(log.detail, /ITCB187083/);
    assert.match(log.detail, /ITCB187074/);
  } finally {
    await pg.close();
  }
});

test("units added in the install window to an install already Installed get its date; the scheduled one when completed is blank", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { updateInstallFor } = await import("../src/lib/ops/api.ts");
    const id = Number((await query("insert into installs (customer, equip_status, complete, install_date, wo) values ($1, 'Installed', true, '2026-11-05', 'WO-1150') returning id", [CUSTOMER]))[0].id);
    await updateInstallFor(sql, { id, machines: [{ equipment: "Bunn ITCB-DV", serial: "ITCB187083", powerVoltage: "" }, { equipment: "Bunn ITCB-DV", serial: "ITCB187074", powerVoltage: "" }] }, { userId: "u-owner" });
    assert.deepEqual((await units(query)).map((u) => [u.serial, u.d]), [["ITCB187074", "2026-11-05"], ["ITCB187083", "2026-11-05"]]);
    const log = (await query("select actor_name, detail from activity where entity_type = 'install' and entity_id = $1 and action = 'install-date'", [id]))[0];
    assert.equal(log.actor_name, "chuy.zz");
    assert.match(log.detail, /2026-11-05 \(the install's scheduled date: it has no completed date\)/);
  } finally {
    await pg.close();
  }
});

test("an open install fills nothing: the date waits until it is Installed", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query, { install_date: "2026-11-20" });
    assert.deepEqual(await F.fillInstallDatesFor(sql, id, "chuy.zz"), []);
    assert.deepEqual((await units(query)).map((u) => u.d), [null, null]);
  } finally {
    await pg.close();
  }
});

test("an install date already set is kept; ownership and Part # are not touched", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    await query("update account_equipment set install_date = '2024-03-01', ownership = 'Customer Owned', part_number = 'ITCB-DV-01' where serial = 'ITCB187083'");
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [id]);
    const filled = await F.fillInstallDatesFor(sql, id, "chuy.zz");
    assert.deepEqual(filled.map((r) => [r.serial, r.date, r.source]), [["ITCB187074", "2026-11-10", "completed"]]);
    const byserial = Object.fromEntries((await units(query)).map((u) => [u.serial, u]));
    assert.deepEqual([byserial.ITCB187083.d, byserial.ITCB187083.ownership, byserial.ITCB187083.part_number], ["2024-03-01", "Customer Owned", "ITCB-DV-01"]);
    assert.equal(byserial.ITCB187074.d, "2026-11-10");
  } finally {
    await pg.close();
  }
});

test("a Locked unit is skipped", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    await query("update account_equipment set locked_at = now(), locked_by = 'chuy.zz' where serial = 'ITCB187074'");
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [id]);
    const filled = await F.fillInstallDatesFor(sql, id, "chuy.zz");
    assert.deepEqual(filled.map((r) => r.serial), ["ITCB187083"]);
    const byserial = Object.fromEntries((await units(query)).map((u) => [u.serial, u.d]));
    assert.deepEqual(byserial, { ITCB187074: null, ITCB187083: "2026-11-10" });
  } finally {
    await pg.close();
  }
});

test("backfill: Admin only; the preview lists every row it would write and the skipped ones, and writes nothing until Apply", async () => {
  const { pg, sql, query } = await fresh();
  try {
    // Installed before this change: blank dates, as on production today.
    const done = await bunnInstall(sql, query);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [done]);
    await query("update account_equipment set install_date = null");
    await query("update account_equipment set locked_at = now(), locked_by = 'chuy.zz' where serial = 'ITCB187074'");
    // An Installed install with no date at all, and an open one.
    const noDate = Number((await query(`insert into installs (customer, equipment, machines, equip_status, complete) values ($1, 'Bunn TB3', $2, 'Installed', true) returning id`, [CUSTOMER, JSON.stringify([{ equipment: "Bunn TB3", serial: "TB3-555", powerVoltage: "" }])]))[0].id);
    await query("update installs set equip_status = 'Not Ready', complete = false where id = $1", [noDate]);
    await syncInstallUnits(sql, noDate);
    await query("update installs set equip_status = 'Installed', complete = true where id = $1", [noDate]);
    await bunnInstall(sql, query, { wo: "WO-1199", machines: JSON.stringify([{ equipment: "Bunn TB3", serial: "TB3-777", powerVoltage: "" }]), equipment: "Bunn TB3" });

    await assert.rejects(F.previewInstallDateBackfillFor(sql, "u-tech"), new RegExp(F.ADMIN_ONLY.slice(0, 20)));
    const before = await units(query);
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.deepEqual(p.rows.map((r) => [r.serial, r.date, r.source, r.installId]), [["ITCB187083", "2026-11-10", "completed", done]]);
    assert.deepEqual(
      p.skipped.map((r) => [r.serial, r.reason]).sort(),
      [["ITCB187074", F.SKIP_LOCKED], ["TB3-555", F.SKIP_NO_DATE]],
    );
    // The open install's unit isn't listed at all.
    assert.equal([...p.rows, ...p.skipped].some((r) => r.serial === "TB3-777"), false);
    // The preview wrote nothing.
    assert.deepEqual(await units(query), before);

    await assert.rejects(F.applyInstallDateBackfillFor(sql, "u-tech", { rows: p.rows }), new RegExp(F.ADMIN_ONLY.slice(0, 20)));
    // Skipped units sent anyway are still not written.
    const res = await F.applyInstallDateBackfillFor(sql, "u-owner", { rows: [...p.rows, ...p.skipped.map((r) => ({ unitId: r.unitId, date: "2026-11-10" }))] });
    assert.deepEqual(res.written.map((r) => [r.serial, r.date]), [["ITCB187083", "2026-11-10"]]);
    const after = Object.fromEntries((await units(query)).map((u) => [u.serial, u.d]));
    assert.deepEqual(after, { ITCB187074: null, ITCB187083: "2026-11-10", "TB3-555": null, "TB3-777": null });
    // Apply again: nothing left to write.
    assert.deepEqual((await F.applyInstallDateBackfillFor(sql, "u-owner", { rows: p.rows })).written, []);
    assert.deepEqual((await F.previewInstallDateBackfillFor(sql, "u-owner")).rows, []);
  } finally {
    await pg.close();
  }
});

test("backfill apply writes only what is still blank: a date set after the preview is kept", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const done = await bunnInstall(sql, query);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [done]);
    await query("update account_equipment set install_date = null");
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.equal(p.rows.length, 2);
    await query("update account_equipment set install_date = '2025-01-02' where serial = 'ITCB187083'");
    const res = await F.applyInstallDateBackfillFor(sql, "u-owner", { rows: p.rows });
    assert.deepEqual(res.written.map((r) => r.serial), ["ITCB187074"]);
    assert.deepEqual((await units(query)).map((u) => [u.serial, u.d]), [["ITCB187074", "2026-11-10"], ["ITCB187083", "2025-01-02"]]);
  } finally {
    await pg.close();
  }
});

test("reading an Installed install writes nothing: only saves fill dates", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [id]);
    await readInspection(sql, id);
    await loadInspectionSummaries(sql, [id]);
    assert.deepEqual((await units(query)).map((u) => u.d), [null, null]);
    assert.equal((await query("select count(*)::int as n from activity where action = 'install-date'"))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("filling a date leaves the install's pre-inspection as it was: its units stay New", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [id]);
    const before = (await loadInspectionSummaries(sql, [id])).get(id);
    await F.fillInstallDatesFor(sql, id, "chuy.zz");
    assert.deepEqual((await units(query)).map((u) => u.d), ["2026-11-10", "2026-11-10"]);
    const after = (await loadInspectionSummaries(sql, [id])).get(id);
    assert.deepEqual([after.overall, after.passedCount, after.machineCount], [before.overall, before.passedCount, before.machineCount]);
    assert.deepEqual((await query("select visit_kind from install_inspection_units where install_id = $1", [id])).map((r) => r.visit_kind), ["new", "new"]);
  } finally {
    await pg.close();
  }
});

test("backfill Write uses the date the preview showed: one that changed since writes nothing", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [id]);
    await query("update account_equipment set install_date = null");
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    await query("update installs set completed_at = '2026-11-12' where id = $1", [id]);
    assert.deepEqual((await F.applyInstallDateBackfillFor(sql, "u-owner", { rows: p.rows })).written, []);
    assert.deepEqual((await units(query)).map((u) => u.d), [null, null]);
  } finally {
    await pg.close();
  }
});

test("a unit on two Installed installs takes the date of the install that made it", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const first = await bunnInstall(sql, query);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [first]);
    // A later visit (no kind chosen) links the same unit.
    const later = Number((await query("insert into installs (customer, equip_status, complete, completed_at) values ($1, 'Installed', true, '2026-12-01') returning id", [CUSTOMER]))[0].id);
    const unit = (await query("select id from account_equipment where serial = 'ITCB187083'"))[0].id;
    await query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [later, unit]);
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.deepEqual(p.rows.map((r) => [r.serial, r.installId, r.date]), [["ITCB187074", first, "2026-11-10"], ["ITCB187083", first, "2026-11-10"]]);
    assert.deepEqual(p.skipped, []);
  } finally {
    await pg.close();
  }
});

// 11/18 follow-up: units the install matched on the account (imported or added by hand first) are the ones installed.
/** A unit imported onto the account `daysBefore` the install's date, then claimed by the install's list by serial. */
async function matchedInstall(sql, query, { serial = "ITCB187083", daysBefore = 0, completed = "2026-11-10", scheduled = null, wo = "WO-1150" } = {}) {
  const day = completed ?? scheduled;
  await query(
    `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, created_at)
     values ($1, 'Bunn ITCB-DV', 'Bunn ITCB-DV', $2, lower($2), $3::date - make_interval(days => $4))`,
    [CUSTOMER, serial, day, daysBefore],
  );
  const id = await bunnInstall(sql, query, { wo, machines: JSON.stringify([{ equipment: "Bunn ITCB-DV", serial, powerVoltage: "" }]), equipment: "Bunn ITCB-DV" });
  const unit = (await query("select id, created_by_install from account_equipment where serial = $1", [serial]))[0];
  assert.equal(unit.created_by_install, null, "the install's list claimed the unit already on the account");
  await query("update installs set equip_status = 'Installed', complete = true, completed_at = $2, install_date = $3 where id = $1", [id, completed, scheduled]);
  return { id, unitId: unit.id };
}
const kindOf = async (query, installId, unitId) => (await query("select visit_kind from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, unitId]))[0].visit_kind;

test("a matched unit takes the install's completed date; its pre-inspection kind is left as it is", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id, unitId } = await matchedInstall(sql, query);
    const filled = await F.fillInstallDatesFor(sql, id, "chuy.zz");
    assert.deepEqual(filled.map((r) => [r.serial, r.date, r.source, r.match]), [["ITCB187083", "2026-11-10", "completed", "matched"]]);
    assert.equal((await units(query))[0].d, "2026-11-10");
    assert.equal(await kindOf(query, id, unitId), null);
    const log = (await query("select detail from activity where action = 'install-date' and entity_id = $1", [id]))[0];
    assert.match(log.detail, /Install date 2026-11-10 \(the install's completed date\) set on: Bunn ITCB-DV ITCB187083/);
  } finally {
    await pg.close();
  }
});

test("a matched unit takes the scheduled date when the install has no completed date", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id } = await matchedInstall(sql, query, { completed: null, scheduled: "2026-11-05" });
    assert.deepEqual((await F.fillInstallDatesFor(sql, id, "chuy.zz")).map((r) => [r.date, r.source]), [["2026-11-05", "scheduled"]]);
  } finally {
    await pg.close();
  }
});

test("a matched unit with a date already set keeps it; a Locked matched unit is skipped", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id } = await matchedInstall(sql, query);
    await query("update account_equipment set install_date = '2023-05-01'");
    assert.deepEqual(await F.fillInstallDatesFor(sql, id, "chuy.zz"), []);
    assert.equal((await units(query))[0].d, "2023-05-01");
    await query("update account_equipment set install_date = null, locked_at = now(), locked_by = 'chuy.zz'");
    assert.deepEqual(await F.fillInstallDatesFor(sql, id, "chuy.zz"), []);
    assert.equal((await units(query))[0].d, null);
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.deepEqual(p.skipped.map((r) => [r.serial, r.reason, r.match]), [["ITCB187083", F.SKIP_LOCKED, "matched"]]);
  } finally {
    await pg.close();
  }
});

test("a unit marked Existing on the pre-inspection takes the date too, and stays Existing", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id, unitId } = await matchedInstall(sql, query);
    await query("update install_inspection_units set visit_kind = 'existing' where install_id = $1", [id]);
    assert.deepEqual((await F.fillInstallDatesFor(sql, id, "chuy.zz")).map((r) => r.serial), ["ITCB187083"]);
    assert.equal(await kindOf(query, id, unitId), "existing");
  } finally {
    await pg.close();
  }
});

test("guard: a matched unit on the account over 30 days before the install, with an earlier ticket naming its serial, is skipped", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id } = await matchedInstall(sql, query, { daysBefore: 200 });
    // An earlier service ticket on the account that names the serial: the unit was there already.
    await query("insert into service_jobs (kind, call_id, customer, received, equipment, issue, status) values ('service', 'SC-202605-001', $1, '2026-05-02', 'Bunn ITCB-DV SN ITCB187083', 'Leaking', 'Completed')", [CUSTOMER]);
    assert.deepEqual(await F.fillInstallDatesFor(sql, id, "chuy.zz"), []);
    assert.equal((await units(query))[0].d, null);
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.deepEqual(p.rows, []);
    assert.deepEqual(p.skipped.map((r) => [r.serial, r.reason]), [["ITCB187083", F.SKIP_EARLIER]]);
    // Write refuses it even if it is sent.
    assert.deepEqual((await F.applyInstallDateBackfillFor(sql, "u-owner", { rows: [{ unitId: p.skipped[0].unitId, date: "2026-11-10" }] })).written, []);
  } finally {
    await pg.close();
  }
});

test("guard needs both: an old unit with no earlier ticket, a new unit with one, or only the install's own visit ticket, are filled", async () => {
  const { pg, sql, query } = await fresh();
  try {
    // Old, no earlier ticket naming it.
    const a = await matchedInstall(sql, query, { serial: "AAA11111", daysBefore: 200, wo: "WO-2001" });
    await query("insert into service_jobs (kind, call_id, customer, received, equipment, status) values ('service', 'SC-1', $1, '2026-05-02', 'Bunn ITCB-DV SN OTHER999', 'Completed')", [CUSTOMER]);
    // Recent (10 days), with an earlier ticket naming it.
    const b = await matchedInstall(sql, query, { serial: "BBB22222", daysBefore: 10, wo: "WO-2002" });
    await query("insert into service_jobs (kind, call_id, customer, received, equipment, status) values ('service', 'SC-2', $1, '2026-11-03', 'SN BBB22222', 'Completed')", [CUSTOMER]);
    // Old, and the only earlier ticket naming it is this install's own pre-install visit.
    const c = await matchedInstall(sql, query, { serial: "CCC33333", daysBefore: 200, wo: "WO-2003" });
    await query("insert into service_jobs (kind, call_id, customer, received, equipment, status, visit_install_id) values ('service', 'SC-3', $1, '2026-10-01', 'SN CCC33333', 'Completed', $2)", [CUSTOMER, c.id]);
    for (const x of [a, b, c]) assert.equal((await F.fillInstallDatesFor(sql, x.id, "chuy.zz")).length, 1);
    assert.deepEqual((await units(query)).map((u) => [u.serial, u.d]), [["AAA11111", "2026-11-10"], ["BBB22222", "2026-11-10"], ["CCC33333", "2026-11-10"]]);
  } finally {
    await pg.close();
  }
});

test("a unit matched by two Installed installs takes the earliest dated one, and the preview says so", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id: later, unitId } = await matchedInstall(sql, query, { completed: "2026-11-10" });
    const earlier = Number((await query("insert into installs (customer, equip_status, complete, completed_at) values ($1, 'Installed', true, '2026-09-15') returning id", [CUSTOMER]))[0].id);
    await query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [earlier, unitId]);
    const p = await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.deepEqual(p.rows.map((r) => [r.serial, r.installId, r.date, r.installCount, r.match]), [["ITCB187083", earlier, "2026-09-15", 2, "matched"]]);
    // Saving the later install doesn't write its own (later) date: the unit goes by the earlier one.
    assert.deepEqual(await F.fillInstallDatesFor(sql, later, "chuy.zz"), []);
    assert.deepEqual((await F.fillInstallDatesFor(sql, earlier, "chuy.zz")).map((r) => r.date), ["2026-09-15"]);
  } finally {
    await pg.close();
  }
});

test("reading an install with a matched unit writes nothing", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const { id } = await matchedInstall(sql, query);
    await readInspection(sql, id);
    await loadInspectionSummaries(sql, [id]);
    await F.previewInstallDateBackfillFor(sql, "u-owner");
    assert.equal((await units(query))[0].d, null);
  } finally {
    await pg.close();
  }
});
