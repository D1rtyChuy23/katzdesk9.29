// Equipment change history (Chuy, 11/19, after Lopez Mexican Restaurant install #191 lost two units with no trace).
// Every create, update, move, retire, put-back and remove of a unit, and every add or removal on an install, is
// recorded with who, when, field, old value and new value, and the record can't be edited or deleted.
// Made-up accounts and people.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const H = await import("../src/lib/ops/unit-history.ts");
const E = await import("../src/lib/ops/account-equip-edit.ts");
const { removeEquipmentUnit, putBackEquipmentUnit } = await import("../src/lib/ops/account-equip-import.ts");

const MODEL = "Bunn ITCB-DV";
const LOPEZ = "ZZ Lopez Cafe";
const TWO = "ZZ Two Step Tacos";

/** The real migrations on an in-memory database, with a client that can name who writes, as production's can. */
export async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const make = (run) => {
    const sql = Object.assign(async (strings, ...values) => run(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query: run });
    return sql;
  };
  const sql = make(async (text, params) => (await pg.query(text, params)).rows);
  sql.as = (actor, action) =>
    make(async (text, params) =>
      pg.transaction(async (tx) => {
        await tx.query("select set_config('katz.actor', $1, true), set_config('katz.action', $2, true)", [actor, action ?? ""]);
        return (await tx.query(text, params)).rows;
      }),
    );
  await pg.query("insert into directory_equipment (name) values ($1)", [MODEL]);
  await pg.query("insert into directory_customers (name) values ($1), ($2)", [LOPEZ, TWO]);
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u_boss', 'boss.zz', true, true), ('u_tech', 'tech.zz', true, false)");
  const history = async (unitId) => (await pg.query("select action, field, old_value, new_value, actor from equipment_history where unit_id = $1 order by id", [unitId])).rows;
  const seen = async (id) => (await pg.query("select updated_at::text as t from account_equipment where id = $1", [id])).rows[0].t;
  return { pg, sql, history, seen };
}

test("adding and editing a unit records each field, with who, old value and new value", async () => {
  const { pg, sql, history, seen } = await fresh();
  try {
    const added = await E.addEquipmentUnit(H.asActor(sql, "boss.zz"), LOPEZ, { model: MODEL, serial: "ZZITCB076334", partNumber: "ITCB-DV-01", ownership: "Loaned" });
    const created = await history(added.id);
    assert.ok(created.every((r) => r.action === "create" && r.actor === "boss.zz" && r.old_value === null));
    assert.deepEqual(
      created.map((r) => [r.field, r.new_value]).filter(([f]) => ["serial", "part_number", "ownership", "customer"].includes(f)),
      [["customer", LOPEZ], ["serial", "ZZITCB076334"], ["part_number", "ITCB-DV-01"], ["ownership", "Loaned"]],
    );
    await E.editEquipmentUnit(H.asActor(sql, "tech.zz"), added.id, { seen: await seen(added.id), partNumber: "ITCB-DV-02", ownership: "Loaned", installDate: "2026-11-10" });
    const edits = (await history(added.id)).filter((r) => r.action === "update");
    assert.deepEqual(edits.map((r) => [r.field, r.old_value, r.new_value, r.actor]), [
      ["part_number", "ITCB-DV-01", "ITCB-DV-02", "tech.zz"],
      ["install_date", null, "2026-11-10", "tech.zz"],
    ]);
  } finally {
    await pg.close();
  }
});

test("a write that doesn't name anyone is still recorded, as System", async () => {
  const { pg, history } = await fresh();
  try {
    const id = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, 'ZZ1', 'zz1') returning id", [LOPEZ, MODEL])).rows[0].id;
    await pg.query("update account_equipment set condition = 'Good' where id = $1", [id]);
    const rows = await history(id);
    assert.ok(rows.length >= 3);
    assert.ok(rows.every((r) => r.actor === "System"));
    assert.deepEqual(rows.at(-1), { action: "update", field: "condition", old_value: null, new_value: "Good", actor: "System" });
  } finally {
    await pg.close();
  }
});

test("removing a unit and putting it back are both recorded; the history survives the removal", async () => {
  const { pg, sql, history } = await fresh();
  try {
    const added = await E.addEquipmentUnit(sql, LOPEZ, { model: MODEL, serial: "ZZITCB083077" });
    await removeEquipmentUnit(H.asActor(sql, "boss.zz", "retire"), added.id, { userId: "u_boss", name: "boss.zz" });
    let rows = await history(added.id);
    const gone = rows.at(-1);
    assert.equal(gone.action, "retire");
    assert.equal(gone.actor, "boss.zz");
    assert.match(gone.old_value, /SN ZZITCB083077/);
    const retiredId = (await pg.query("select id from account_equipment_retired where unit_id = $1", [added.id])).rows[0].id;
    await putBackEquipmentUnit(H.asActor(sql, "boss.zz", "put_back"), retiredId);
    rows = await history(added.id);
    assert.ok(rows.some((r) => r.action === "put_back" && r.field === "serial" && r.new_value === "ZZITCB083077" && r.actor === "boss.zz"));
    assert.equal((await H.listUnitHistory(sql, added.id))[0].action, "put_back");
  } finally {
    await pg.close();
  }
});

test("history can't be edited or deleted", async () => {
  const { pg, sql } = await fresh();
  try {
    await E.addEquipmentUnit(sql, LOPEZ, { model: MODEL, serial: "ZZ2" });
    await assert.rejects(pg.query("update equipment_history set actor = 'someone else'"), /append-only/);
    await assert.rejects(pg.query("delete from equipment_history"), /append-only/);
    assert.ok(Number((await pg.query("select count(*)::int as n from equipment_history")).rows[0].n) > 0);
  } finally {
    await pg.close();
  }
});

test("an install's history shows its list changes and the units added to and taken off it", async () => {
  const { pg, sql } = await fresh();
  try {
    const unit = (await E.addEquipmentUnit(sql, LOPEZ, { model: MODEL, serial: "ZZITCB154148" })).id;
    const install = (await pg.query("insert into installs (customer, equipment, wo) values ($1, $2, 'WO-1136') returning id", [LOPEZ, MODEL])).rows[0].id;
    const who = H.asActor(sql, "boss.zz");
    await who.query("update installs set machines = $2 where id = $1", [install, JSON.stringify([{ equipment: MODEL, serial: "ZZITCB154148" }])]);
    await who.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [install, unit]);
    await who.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [install, unit]);
    const rows = await H.listInstallHistory(sql, install);
    const mine = rows.filter((r) => r.installId === install).map((r) => [r.action, r.field, r.oldValue, r.newValue, r.actor]);
    assert.deepEqual(mine.reverse(), [
      ["update", "equipment list", null, `${MODEL} SN ZZITCB154148`, "boss.zz"],
      ["add_to_install", "install", null, `${MODEL} · SN ZZITCB154148`, "boss.zz"],
      ["remove_from_install", "install", `${MODEL} · SN ZZITCB154148`, null, "boss.zz"],
    ]);
    // The unit's own changes show there too, once it has been on the install.
    assert.ok(rows.some((r) => r.unitId === unit && r.action === "create"));
  } finally {
    await pg.close();
  }
});

test("a serial moved from another account onto an install keeps its Part #, Ownership, Install date, Condition, Electrical and Model", async () => {
  const { pg, sql, history } = await fresh();
  try {
    const P = await import("../src/lib/ops/serial-pull.ts");
    await P.ensureSerialNotice(sql);
    const from = (
      await pg.query(
        `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, part_number, ownership, install_date, condition, electrical)
         values ($1, $2, $2, 'Itcb154148', 'itcb154148', 'ITCB-DV-01', 'Loaned', '2024-06-01', 'Good', '120V') returning id`,
        [TWO, MODEL],
      )
    ).rows[0].id;
    const install = (await pg.query("insert into installs (customer, equipment, wo) values ($1, $2, '1136') returning id", [LOPEZ, MODEL])).rows[0].id;
    const moved = await P.pullSerial(sql, "u_boss", { serial: "ITCB154148", installId: install, machineIndex: 0, moveFrom: TWO });
    assert.equal(moved.needsConfirm, false);
    const on = (await pg.query("select id, catalog_model, part_number, ownership, install_date::text as install_date, condition, electrical from account_equipment where lower(customer) = lower($1)", [LOPEZ])).rows;
    assert.equal(on.length, 1);
    assert.deepEqual(
      { ...on[0], id: undefined },
      { id: undefined, catalog_model: MODEL, part_number: "ITCB-DV-01", ownership: "Loaned", install_date: "2024-06-01", condition: "Good", electrical: "120V" },
    );
    // The old unit's history ends in the move; the new one's shows the details carried over as a move.
    assert.equal((await history(from)).at(-1).action, "move");
    assert.ok((await history(on[0].id)).some((r) => r.action === "move" && r.field === "part_number" && r.new_value === "ITCB-DV-01"));
  } finally {
    await pg.close();
  }
});

test("someone who isn't an Admin asks for a move; nothing moves until an Admin confirms it", async () => {
  const { pg, sql } = await fresh();
  try {
    const P = await import("../src/lib/ops/serial-pull.ts");
    const M = await import("../src/lib/ops/move-requests.ts");
    await P.ensureSerialNotice(sql);
    await pg.query(
      `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, part_number) values ($1, $2, $2, 'ZZITCB154148', 'zzitcb154148', 'ITCB-DV-01')`,
      [TWO, MODEL],
    );
    const install = (await pg.query("insert into installs (customer, equipment, wo) values ($1, $2, '1136') returning id", [LOPEZ, MODEL])).rows[0].id;
    const asked = await P.pullSerial(sql, "u_tech", { serial: "ZZITCB154148", installId: install, machineIndex: 0, moveFrom: TWO });
    assert.equal(asked.moveAsked, true);
    assert.match(asked.notice, /^Move asked: an Admin confirms/);
    const where = async () => (await pg.query("select customer from account_equipment where serial_key = 'zzitcb154148'")).rows.map((r) => r.customer);
    assert.deepEqual(await where(), [TWO]);
    // Asking again doesn't make a second ask.
    await P.pullSerial(sql, "u_tech", { serial: "ZZITCB154148", installId: install, machineIndex: 0, moveFrom: TWO });
    const open = await M.listMoveRequests(sql, install);
    assert.deepEqual(open.map((r) => [r.serial, r.fromCustomer, r.toCustomer, r.askedBy]), [["ZZITCB154148", TWO, LOPEZ, "tech.zz"]]);
    await assert.rejects(M.decideMoveRequest(sql, "u_tech", open[0].id, true), new RegExp(M.MOVE_ADMIN_ONLY));
    await M.decideMoveRequest(sql, "u_boss", open[0].id, true);
    assert.deepEqual(await where(), [LOPEZ]);
    assert.equal((await pg.query("select part_number from account_equipment where serial_key = 'zzitcb154148'")).rows[0].part_number, "ITCB-DV-01");
    assert.deepEqual(await M.listMoveRequests(sql, install), []);
    await assert.rejects(M.decideMoveRequest(sql, "u_boss", open[0].id, false), /already answered/);
  } finally {
    await pg.close();
  }
});

test("an Admin can decline a move; the unit stays where it is", async () => {
  const { pg, sql } = await fresh();
  try {
    const P = await import("../src/lib/ops/serial-pull.ts");
    const M = await import("../src/lib/ops/move-requests.ts");
    await P.ensureSerialNotice(sql);
    await pg.query(`insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, 'ZZ777', 'zz777')`, [TWO, MODEL]);
    const install = (await pg.query("insert into installs (customer, equipment, wo) values ($1, $2, '1137') returning id", [LOPEZ, MODEL])).rows[0].id;
    await P.pullSerial(sql, "u_tech", { serial: "ZZ777", installId: install, machineIndex: 0, moveFrom: TWO });
    const [ask] = await M.listMoveRequests(sql, install);
    assert.equal((await M.decideMoveRequest(sql, "u_boss", ask.id, false)).notice, "Move declined.");
    assert.deepEqual((await pg.query("select customer from account_equipment where serial_key = 'zz777'")).rows.map((r) => r.customer), [TWO]);
  } finally {
    await pg.close();
  }
});

test("the unit form: anyone sets Condition; only an Admin changes the Serial, and never to one another unit has", async () => {
  const { pg, sql, seen, history } = await fresh();
  try {
    const u = await E.addEquipmentUnit(sql, LOPEZ, { model: MODEL, serial: "Itcb154148" });
    assert.equal(u.serial, "ITCB154148");
    await E.addEquipmentUnit(sql, TWO, { model: MODEL, serial: "ZZTAKEN1" });
    const base = { partNumber: null, ownership: null, installDate: null };
    await E.editEquipmentUnit(sql, u.id, { ...base, seen: await seen(u.id), condition: "Good" });
    assert.equal((await pg.query("select condition from account_equipment where id = $1", [u.id])).rows[0].condition, "Good");
    await assert.rejects(E.editEquipmentUnit(sql, u.id, { ...base, seen: await seen(u.id), serial: "ITCB154149" }), new RegExp(E.SERIAL_EDIT_ADMIN_ONLY));
    // The same serial in another case or spacing isn't a change.
    await E.editEquipmentUnit(sql, u.id, { ...base, seen: await seen(u.id), serial: "itcb 154148", condition: "Good" });
    await assert.rejects(E.editEquipmentUnit(sql, u.id, { ...base, seen: await seen(u.id), serial: "zztaken1" }, { admin: true }), new RegExp(TWO));
    await E.editEquipmentUnit(H.asActor(sql, "boss.zz"), u.id, { ...base, seen: await seen(u.id), serial: "itcb154149", condition: "Good" }, { admin: true });
    const row = (await pg.query("select serial, serial_key from account_equipment where id = $1", [u.id])).rows[0];
    assert.deepEqual(row, { serial: "ITCB154149", serial_key: "itcb154149" });
    assert.ok((await history(u.id)).some((r) => r.field === "serial" && r.old_value === "ITCB154148" && r.new_value === "ITCB154149" && r.actor === "boss.zz"));
  } finally {
    await pg.close();
  }
});

test("confirming a move after that row got its own serial adds the unit as a new row; it never overwrites the row", async () => {
  const { pg, sql } = await fresh();
  try {
    const P = await import("../src/lib/ops/serial-pull.ts");
    const M = await import("../src/lib/ops/move-requests.ts");
    const { syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
    const machines = await import("../src/lib/ops/machines.ts");
    await P.ensureSerialNotice(sql);
    await pg.query(`insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, part_number) values ($1, $2, $2, 'ZZMOVE1', 'zzmove1', 'PN-1')`, [TWO, MODEL]);
    const install = (await pg.query("insert into installs (customer, equipment, wo) values ($1, $2, '1140') returning id", [LOPEZ, MODEL])).rows[0].id;
    await P.pullSerial(sql, "u_tech", { serial: "ZZMOVE1", installId: install, machineIndex: 0, moveFrom: TWO });
    // Meanwhile row 0 gets its own machine and serial.
    const packed = machines.serializeMachines([{ equipment: MODEL, serial: "AAA111", powerVoltage: "" }]);
    await pg.query("update installs set equipment = $2, serial = $3, machines = $4 where id = $1", [install, packed.equipment, packed.serial, packed.machines]);
    await syncInstallUnits(sql, install);
    const [ask] = await M.listMoveRequests(sql, install);
    await M.decideMoveRequest(sql, "u_boss", ask.id, true);
    const list = machines.parseMachinesJson((await pg.query("select machines from installs where id = $1", [install])).rows[0].machines).map((m) => m.serial);
    assert.deepEqual(list.sort(), ["AAA111", "ZZMOVE1"]);
    const onLopez = (await pg.query("select serial, part_number from account_equipment where lower(customer) = lower($1) order by serial", [LOPEZ])).rows;
    assert.deepEqual(onLopez, [{ serial: "AAA111", part_number: null }, { serial: "ZZMOVE1", part_number: "PN-1" }]);
  } finally {
    await pg.close();
  }
});

test("merging two units keeps the dropped one's details on the kept unit, and keeps its record on the Retired list", async () => {
  const { pg, sql, history } = await fresh();
  try {
    const { mergeEquipmentUnits } = await import("../src/lib/ops/account-equip-import.ts");
    const { listRetiredUnits } = await import("../src/lib/ops/account-equip-retire.ts");
    const keep = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, part_number) values ($1, $2, $2, 'ZZM1', 'zzm1', 'PN-K') returning id", [LOPEZ, MODEL])).rows[0].id;
    const drop = (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, ownership, install_date, condition) values ($1, $2, $2, 'L', 'l', 'Loaned', '2025-03-01', 'Good') returning id",
        [LOPEZ, MODEL],
      )
    ).rows[0].id;
    await mergeEquipmentUnits(sql, keep, drop);
    const k = (await pg.query("select part_number, ownership, install_date::text as d, condition from account_equipment where id = $1", [keep])).rows[0];
    assert.deepEqual(k, { part_number: "PN-K", ownership: "Loaned", d: "2025-03-01", condition: "Good" });
    assert.deepEqual((await listRetiredUnits(sql, LOPEZ)).map((r) => r.unitId), [drop]);
    assert.equal((await history(drop)).at(-1).action, "merge");
  } finally {
    await pg.close();
  }
});
