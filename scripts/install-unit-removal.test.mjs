// Taking a unit off an install is reversible and an Admin's (Chuy, 11/19, after Lopez Mexican Restaurant install #191
// lost two units). The Equipment tab's Remove keeps the unit's row, checks and photos under the install's Removed,
// and Put back returns them. On a Ready install, or one whose pre-inspection passed, it needs a confirm and sets the
// install back to Not Ready. Someone who isn't an Admin can't take a unit off: their save puts its row back.
// Made-up accounts and people.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
register(new URL("./ts-alias-hook.mjs", import.meta.url));
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const I = await import("../src/lib/ops/inspection-api.ts");
const machines = await import("../src/lib/ops/machines.ts");

const MODEL = "Bunn ITCB-DV";
const SITE = "ZZ Lopez Cafe";

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1)", [MODEL]);
  const sql = { query: async (t, p) => (await pg.query(t, p)).rows };
  // An install with three Bunns on its list, units made by its load, and a check recorded on the second.
  const list = ["ZZITCB076334", "ZZITCB083077", "ZZITCB154148"].map((serial) => ({ equipment: MODEL, serial, powerVoltage: "" }));
  const packed = machines.serializeMachines(list);
  const id = (
    await pg.query("insert into installs (customer, equipment, serial, machines, wo, equip_status) values ($1, $2, $3, $4, 'WO-1136', 'Not Ready') returning id", [
      SITE,
      packed.equipment,
      packed.serial,
      packed.machines,
    ])
  ).rows[0].id;
  await I.readInspection(sql, id);
  const unit = async (serial) => (await pg.query("select id from account_equipment where serial = $1", [serial])).rows[0]?.id ?? null;
  const second = await unit("ZZITCB083077");
  await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, 'electrical', 'Passed', 'ZZ 20A circuit')", [id, second]);
  const onList = async () => machines.parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines).map((m) => m.serial);
  const onVisit = async () => (await pg.query("select equipment_id from install_inspection_units where install_id = $1 order by equipment_id", [id])).rows.map((r) => r.equipment_id);
  return { pg, sql, id, unit, second, onList, onVisit };
}

test("Remove on the Equipment tab keeps the unit under Removed, and Put back returns its row and its checks", async () => {
  const { pg, sql, id, second, onList, onVisit } = await fresh();
  try {
    await I.removeInstallRow(sql, { installId: id, index: 1, equipment: MODEL, serial: "ZZITCB083077", unitId: second }, "boss.zz", { admin: true });
    assert.deepEqual(await onList(), ["ZZITCB076334", "ZZITCB154148"]);
    assert.equal((await onVisit()).includes(second), false);
    assert.equal((await pg.query("select count(*)::int as n from install_inspection_items where equipment_id = $1", [second])).rows[0].n, 0);
    const removed = await I.listInstallRemoved(sql, id);
    assert.deepEqual(removed.map((r) => [r.unitId, r.equipment, r.serial, r.records, r.unitGone]), [[second, MODEL, "ZZITCB083077", 1, false]]);
    await I.putBackInstallUnit(sql, removed[0].id, "boss.zz");
    assert.deepEqual(await onList(), ["ZZITCB076334", "ZZITCB154148", "ZZITCB083077"]);
    assert.equal((await onVisit()).includes(second), true);
    const note = (await pg.query("select notes from install_inspection_items where install_id = $1 and equipment_id = $2", [id, second])).rows[0]?.notes;
    assert.equal(note, "ZZ 20A circuit");
    assert.deepEqual(await I.listInstallRemoved(sql, id), []);
    await assert.rejects(I.putBackInstallUnit(sql, removed[0].id, "boss.zz"), /already put back/);
  } finally {
    await pg.close();
  }
});

test("only an Admin can take a unit off an install, by any of the three ways", async () => {
  const { pg, sql, id, second, onList, onVisit } = await fresh();
  try {
    await assert.rejects(I.removeInstallRow(sql, { installId: id, index: 1, equipment: MODEL, serial: "ZZITCB083077", unitId: second }, "tech.zz", {}), new RegExp(I.REMOVE_ADMIN_ONLY.slice(0, 30)));
    await assert.rejects(I.removeInspectionUnit(sql, { installId: id, equipmentId: second }, "tech.zz", {}), new RegExp(I.REMOVE_ADMIN_ONLY.slice(0, 30)));
    // A save by someone else that leaves the row out: the row comes back, and the unit stays on the visit.
    const before = (await pg.query("select equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];
    const packed = machines.serializeMachines(["ZZITCB076334", "ZZITCB154148"].map((serial) => ({ equipment: MODEL, serial, powerVoltage: "" })));
    await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5 where id = $1", [id, packed.equipment, packed.serial, packed.powerVoltage, packed.machines]);
    const kept = [];
    await I.syncInstallUnits(sql, id, { prune: true, before, canRemove: false, keptBack: kept });
    assert.deepEqual(kept, [MODEL]);
    assert.ok((await onList()).includes("ZZITCB083077"));
    assert.ok((await onVisit()).includes(second));
  } finally {
    await pg.close();
  }
});

test("on a Ready install it asks first, then sets the install back to Not Ready", async () => {
  const { pg, sql, id, second } = await fresh();
  try {
    await pg.query("update installs set equip_status = 'Ready' where id = $1", [id]);
    const row = { installId: id, index: 1, equipment: MODEL, serial: "ZZITCB083077", unitId: second };
    await assert.rejects(I.removeInstallRow(sql, row, "boss.zz", { admin: true }), new RegExp(I.REOPEN_NEEDS_CONFIRM.slice(0, 20)));
    assert.equal((await pg.query("select equip_status from installs where id = $1", [id])).rows[0].equip_status, "Ready");
    assert.match(I.reopenConfirmText(`${MODEL} SN ZZITCB083077`, true), /Take Bunn ITCB-DV SN ZZITCB083077 off this install\? The install is Ready and its pre-inspection goes back to Not Ready/);
    await I.removeInstallRow(sql, { ...row, confirmReopen: true }, "boss.zz", { admin: true });
    assert.equal((await pg.query("select equip_status from installs where id = $1", [id])).rows[0].equip_status, "Not Ready");
    const log = (await pg.query("select detail from activity where entity_type = 'install' and entity_id = $1 order by id", [id])).rows.map((r) => r.detail);
    assert.ok(log.some((d) => /set back to Not Ready/.test(d)));
  } finally {
    await pg.close();
  }
});
