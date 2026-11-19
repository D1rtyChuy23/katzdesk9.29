// Change a unit's model from its Edit form (Chuy, 11/19), Admin only. The unit keeps its id, serial, installs,
// inspections and PM links; equipment_name follows only when it was the old model; the install's list row follows so a
// load never drops the unit. Made-up accounts, models and serials only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const A = await import("../src/lib/ops/account-equip-edit.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");
const I = await import("../src/lib/ops/inspection-api.ts");
const M = await import("../src/lib/ops/unit-model-change.ts");
const machines = await import("../src/lib/ops/machines.ts");
const { loadPmRunbookPlan } = await import("../src/lib/ops/pm-runbook-api.ts");

const SITE = "ZZ Model Cafe";
const OLD = 'ZZ Brewer 29" w/Flip Tray';
const NEW = 'ZZ Brewer 29" Trunk, with Tray (New Style)';

async function fresh() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1)", [SITE]);
  await pg.query("insert into directory_equipment (name) values ($1), ($2), ('Linea PB'), ('Linea Classic')", [OLD, NEW]);
  const run = async (t, p) => (await pg.query(t, p)).rows;
  const sql = Object.assign(async (strings, ...values) => run(strings.reduce((a, x, i) => `${a}$${i}${x}`), values), { query: run });
  return { pg, sql, run };
}

const unitOf = async (sql, id) => (await IMP.readAccountUnits(sql, SITE)).find((u) => u.id === id);
const editOf = (u, extra) => ({ seen: u.seen, partNumber: u.partNumber, ownership: u.ownership, installDate: u.installDate, ...extra });

/** An install whose typed list names one serial-less brewer: its load makes the unit and puts it on the visit. */
async function installWithBrewer(pg, sql) {
  const id = (await pg.query("insert into installs (customer, equipment, wo, equip_status) values ($1, $2, 'WO-9001', 'Not Ready') returning id", [SITE, OLD])).rows[0].id;
  await I.readInspection(sql, id);
  const unit = (await pg.query("select id from account_equipment where customer = $1", [SITE])).rows[0].id;
  return { id, unit };
}

test("an Admin changes the model: same id and serial, the install and inspection keep it, equipment_name follows the old name", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id: installId, unit } = await installWithBrewer(pg, sql);
    await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, 'electrical', 'Passed', 'ZZ 20A')", [installId, unit]);
    const before = await unitOf(sql, unit);
    assert.deepEqual([before.catalogModel, before.equipmentName, before.serial], [OLD, OLD, null]);
    const saved = await A.editEquipmentUnit(sql, unit, editOf(before, { model: NEW.toLowerCase() }), { admin: true, who: "boss.zz" });
    assert.deepEqual([saved.id, saved.catalogModel, saved.equipmentName, saved.serial], [unit, NEW, NEW, null], "the list's own spelling");
    // The install's row now names the unit by id and the new model; a load, and a save with prune, keep it on the visit.
    const row = (await pg.query("select equipment, machines from installs where id = $1", [installId])).rows[0];
    const list = machines.parseMachinesJson(row.machines);
    assert.deepEqual(list.map((m) => [m.equipment, m.unitId]), [[NEW, unit]]);
    await I.readInspection(sql, installId);
    await I.syncInstallUnits(sql, installId, { prune: true });
    const visit = (await pg.query("select equipment_id from install_inspection_units where install_id = $1", [installId])).rows.map((r) => r.equipment_id);
    assert.deepEqual(visit, [unit]);
    assert.equal((await pg.query("select count(*)::int as n from install_inspection_items where equipment_id = $1", [unit])).rows[0].n, 1, "its checks stay");
    assert.equal((await pg.query("select count(*)::int as n from account_equipment where customer = $1", [SITE])).rows[0].n, 1, "no second unit made");
    // The activity line: who, the serial, the old and new model.
    const log = (await pg.query("select actor_name, detail, created_at is not null as dated from activity where entity_type = 'customer'")).rows;
    assert.deepEqual(log, [{ actor_name: "boss.zz", detail: `Changed model of a unit with no serial from ${OLD} to ${NEW}`, dated: true }]);
  } finally {
    await pg.close();
  }
});

test("a custom title is kept, and the serial never changes", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (
      await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, 'ZZ Combo Brewer 2', 'ZZB777', 'zzb777') returning id", [SITE, OLD])
    ).rows[0].id;
    const u = await unitOf(sql, id);
    const saved = await A.editEquipmentUnit(sql, id, editOf(u, { model: NEW }), { admin: true, who: "boss.zz" });
    assert.deepEqual([saved.catalogModel, saved.equipmentName, saved.serial], [NEW, "ZZ Combo Brewer 2", "ZZB777"]);
    const log = (await pg.query("select detail from activity")).rows;
    assert.equal(log[0].detail, `Changed model of SN ZZB777 from ${OLD} to ${NEW}`);
  } finally {
    await pg.close();
  }
});

test("a PM's runbook line keeps the unit: an existing pin stays, and an unpinned match is pinned", async () => {
  const { pg, sql } = await fresh();
  try {
    const unit = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, 'Linea PB', 'Linea PB', 'ZZLPB1', 'zzlpb1') returning id", [SITE])).rows[0].id;
    const pm = (await pg.query("insert into pm_jobs (customer, equipment, status) values ($1, 'Linea PB', 'Pending Scheduling') returning id", [SITE])).rows[0].id;
    const before = await loadPmRunbookPlan(sql, SITE, "Linea PB", pm);
    assert.equal(before.planned[0].accountId, unit, "matched by model before");
    const u = await unitOf(sql, unit);
    await A.editEquipmentUnit(sql, unit, editOf(u, { model: "Linea Classic" }), { admin: true, who: "boss.zz" });
    const links = (await pg.query("select piece_key, account_equipment_id from pm_runbook_unit_links where pm_job_id = $1", [pm])).rows;
    assert.deepEqual(links, [{ piece_key: before.planned[0].pieceKey, account_equipment_id: unit }]);
    const after = await loadPmRunbookPlan(sql, SITE, "Linea PB", pm);
    assert.equal(after.planned[0].accountId, unit, "the PM still picks the unit under its new model");
  } finally {
    await pg.close();
  }
});

test("refused: not an Admin (server), a locked unit, a stale read, a model not on the list", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, $2, $2) returning id", [SITE, OLD])).rows[0].id;
    const u = await unitOf(sql, id);
    await assert.rejects(A.editEquipmentUnit(sql, id, editOf(u, { model: NEW }), { admin: false }), new RegExp(M.MODEL_EDIT_ADMIN_ONLY));
    await assert.rejects(A.editEquipmentUnit(sql, id, editOf(u, { model: "ZZ Not A Model" }), { admin: true }), /Add it to the equipment list first/);
    assert.equal((await pg.query("select count(*)::int as n from directory_equipment where name = 'ZZ Not A Model'")).rows[0].n, 0, "never added");
    await assert.rejects(A.editEquipmentUnit(sql, id, editOf(u, { seen: "2000-01-01", model: NEW }), { admin: true }), /changed|again/i);
    await pg.query("update account_equipment set locked_at = now(), locked_by = 'chuy' where id = $1", [id]);
    const locked = await unitOf(sql, id);
    await assert.rejects(A.editEquipmentUnit(sql, id, editOf(locked, { model: NEW }), { admin: true }), /lock/i);
    // The statement itself checks too: locked, or read before a change, it writes nothing.
    const sqlParams = (seen) => [id, null, null, null, seen, false, null, false, null, null, NEW, OLD, "[]", "[]", "boss.zz", "x"];
    assert.deepEqual(await sql.query(M.editUnitModelSql(), sqlParams(locked.seen)), []);
    await pg.query("update account_equipment set locked_at = null, locked_by = null, updated_at = now() + interval '1 second' where id = $1", [id]);
    const open = await unitOf(sql, id);
    assert.deepEqual(await sql.query(M.editUnitModelSql(), sqlParams(locked.seen)), [], "a stale seen");
    assert.equal((await sql.query(M.editUnitModelSql(), sqlParams(open.seen))).length, 1);
    assert.equal((await unitOf(sql, id)).catalogModel, NEW);
    assert.equal((await pg.query("select count(*)::int as n from activity")).rows[0].n, 1, "only the write that happened is logged");
  } finally {
    await pg.close();
  }
});

test("Edit with no model change works exactly as before: same statement, no log", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, $2, $2) returning id", [SITE, OLD])).rows[0].id;
    const u = await unitOf(sql, id);
    // A non-Admin's Edit sending the same model (any capitals) is no model change and isn't refused.
    const saved = await A.editEquipmentUnit(sql, id, editOf(u, { partNumber: "ZZ-1", model: OLD.toUpperCase() }), { admin: false });
    assert.deepEqual([saved.catalogModel, saved.partNumber], [OLD, "ZZ-1"]);
    const again = await A.editEquipmentUnit(sql, id, editOf(saved, { partNumber: "ZZ-2" }), { admin: false });
    assert.equal(again.partNumber, "ZZ-2");
    assert.equal((await pg.query("select count(*)::int as n from activity")).rows[0].n, 0);
    // The plain edit statement is untouched: ten parameters, no model.
    assert.doesNotMatch(A.editUnitSql(), /catalog_model/);
  } finally {
    await pg.close();
  }
});

test("Part # hint: the new model's known Part #, when the unit's is blank or the old model's", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query(
      `insert into account_equipment (customer, catalog_model, equipment_name, part_number) values
        ($1, $2, $2, 'OLD-1'), ($1, $2, $2, 'OLD-1'), ($1, $3, $3, 'NEW-9'), ($1, $3, $3, 'NEW-9'), ($1, $3, $3, 'NEW-8')`,
      [SITE, OLD, NEW],
    );
    assert.deepEqual(await M.knownPartNumbers(sql, [OLD, NEW, "Linea PB"]), { [OLD]: "OLD-1", [NEW]: "NEW-9", "Linea PB": null });
    assert.equal(M.partNumberHint(null, "OLD-1", "NEW-9"), "NEW-9");
    assert.equal(M.partNumberHint("old-1", "OLD-1", "NEW-9"), "NEW-9");
    assert.equal(M.partNumberHint("CUSTOM", "OLD-1", "NEW-9"), null, "a Part # of its own isn't second-guessed");
    assert.equal(M.partNumberHint("", "OLD-1", null), null);
  } finally {
    await pg.close();
  }
});
