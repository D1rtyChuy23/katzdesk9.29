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
const { syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
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

test("units added to an install that is already Installed get its date; the scheduled date only when completed is blank", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query, { equip_status: "Installed", complete: true, install_date: "2026-11-05", completed_at: null });
    // syncInstallUnits added the units to an Installed install: they take its scheduled date, as nothing else is there.
    assert.deepEqual((await units(query)).map((u) => u.d), ["2026-11-05", "2026-11-05"]);
    const log = (await query("select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'install-date'", [id]))[0];
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

test("a unit already on the account before this visit (Existing on the pre-inspection) keeps its blank date", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const id = await bunnInstall(sql, query);
    await query("update install_inspection_units set visit_kind = 'existing' where install_id = $1 and equipment_id = (select id from account_equipment where serial = 'ITCB187074')", [id]);
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-10' where id = $1", [id]);
    assert.deepEqual((await F.fillInstallDatesFor(sql, id, "chuy.zz")).map((r) => r.serial), ["ITCB187083"]);
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

    await assert.rejects(F.applyInstallDateBackfillFor(sql, "u-tech", { unitIds: p.rows.map((r) => r.unitId) }), new RegExp(F.ADMIN_ONLY.slice(0, 20)));
    // A unit someone dated after the preview is left as they set it.
    const res = await F.applyInstallDateBackfillFor(sql, "u-owner", { unitIds: [...p.rows.map((r) => r.unitId), ...p.skipped.map((r) => r.unitId)] });
    assert.deepEqual(res.written.map((r) => [r.serial, r.date]), [["ITCB187083", "2026-11-10"]]);
    const after = Object.fromEntries((await units(query)).map((u) => [u.serial, u.d]));
    assert.deepEqual(after, { ITCB187074: null, ITCB187083: "2026-11-10", "TB3-555": null, "TB3-777": null });
    // Apply again: nothing left to write.
    assert.deepEqual((await F.applyInstallDateBackfillFor(sql, "u-owner", { unitIds: p.rows.map((r) => r.unitId) })).written, []);
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
    const res = await F.applyInstallDateBackfillFor(sql, "u-owner", { unitIds: p.rows.map((r) => r.unitId) });
    assert.deepEqual(res.written.map((r) => r.serial), ["ITCB187074"]);
    assert.deepEqual((await units(query)).map((u) => [u.serial, u.d]), [["ITCB187074", "2026-11-10"], ["ITCB187083", "2025-01-02"]]);
  } finally {
    await pg.close();
  }
});
