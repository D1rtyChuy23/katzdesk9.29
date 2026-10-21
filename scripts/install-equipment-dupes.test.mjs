import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { addMachineOntoInstall, readInspection, syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const { removeEquipmentUnit, mergeEquipmentUnits } = await import("../src/lib/ops/account-equip-import.ts");
const machines = await import("../src/lib/ops/machines.ts");
const { catalogModels, listedEquipment, matchModel } = await import("../src/lib/ops/equipment.ts");
const { placeWarehouseSerial } = await import("../src/lib/ops/warehouse-serial.ts");
const { matchExistingUnit } = await import("../src/lib/ops/account-equip.ts");
const { writeInstallSerial } = await import("../src/lib/ops/serial-pull.ts");

const ITCB_CATALOG = 'Bunn ITCB-DV, 29" w/Flip Tray';

async function fresh(assetModels = []) {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1), ('Bunn G9-2T'), ('Bunn TB3'), ('Fetco 52H')", [ITCB_CATALOG]);
  for (const m of assetModels) await pg.query("insert into assets (kind, model, qty, site, status) values ('equip', $1, 1, 'barn-back', 'ready')", [m]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

const install = async (pg, customer, equipment) =>
  (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [customer, equipment])).rows[0].id;
const acct = async (pg, customer) =>
  (await pg.query("select id, equipment_name, serial from account_equipment where lower(customer) = lower($1) order by id", [customer])).rows;

/** The list the board and the install window read: directory names and warehouse models (loadEquipCatalog). */
const serverCatalog = async (pg) =>
  catalogModels([
    ...(await pg.query("select name from directory_equipment where archived = false")).rows.map((d) => d.name),
    ...(await pg.query("select distinct model from assets where kind = 'equip'")).rows.map((d) => d.model),
  ]);

/** updateInstall's machine part: matchModel on the server catalog, then sync with prune. */
async function saveList(pg, sql, id, specs) {
  const cat = await serverCatalog(pg);
  const packed = machines.serializeMachines(specs);
  const mj = JSON.stringify(machines.parseMachinesJson(packed.machines).map((s) => ({ ...s, equipment: matchModel(s.equipment, cat) })));
  await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5 where id = $1", [id, packed.equipment, packed.serial, packed.powerVoltage, mj]);
  await syncInstallUnits(sql, id, { prune: true });
}

/** The install window's rows (mapInstall: specsFromInstall with the server catalog). */
const windowSpecs = async (pg, id) => {
  const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
  return machines.specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, await serverCatalog(pg));
};

test("a colour or size word after a machine stays on that machine", () => {
  const cat = ["Puqpress Q2 Automatic Tamper", "Mazzer Robur S Electronic", "Bunn G9-2", "Bunn Axiom-APS"];
  assert.deepEqual(listedEquipment("Mazzer Robur S Electronic, Puqpress Q2 Automatic Tamper BLACK, Blendtec Rapid Rinse Station", cat), [
    "Mazzer Robur S Electronic",
    "Puqpress Q2 Automatic Tamper BLACK",
    "Blendtec Rapid Rinse Station",
  ]);
  // Parity #13: the window and the sync both read two machines, and the G9's serial stays on it.
  const text = "Bunn Axiom-APS 120V SN:AXAP049095\nBunn G9-2 Short SN: G900075916";
  assert.deepEqual(listedEquipment(text, cat), ["Bunn Axiom-APS", "Bunn G9-2 Short"]);
  assert.deepEqual(
    machines.specsFromInstall(text, null, null, null, cat).map((s) => [s.equipment, s.serial]),
    [
      ["Bunn Axiom-APS", "AXAP049095"],
      ["Bunn G9-2 Short", "G900075916"],
    ],
  );
  // A word on its own line, or a lone machine, is left as typed.
  assert.deepEqual(listedEquipment("Black", cat), ["Black"]);
});
