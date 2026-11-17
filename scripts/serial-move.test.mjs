// An install can take a serial from another account (Grok for Chuy, 11/17: WO-1120's Bunn came from an account that
// was repossessed). The serial box on an install asks first. On Move, the unit leaves the old account the way its own
// Remove takes it off (kept on that account's Retired list, with its history, and Put back works) and the serial goes
// onto the install. A retired unit holds no serial, and a stored "not moved" notice stops showing once the old
// account no longer has the serial. Tickets and the warehouse Reuse prompt are unchanged. Made-up names throughout.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const P = await import("../src/lib/ops/serial-pull.ts");
const { removeEquipmentUnit, putBackEquipmentUnit } = await import("../src/lib/ops/account-equip-import.ts");
const { listRetiredUnits } = await import("../src/lib/ops/account-equip-retire.ts");

const MODEL = 'Bunn ITCB-DV, 29" w/Flip Tray';
const OLD = "ZZ Ice House - Memorial";
const NEW = "ZZ Cantina - Webster";

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  await P.ensureSerialNotice(sql);
  await pg.query("insert into directory_equipment (name) values ($1)", [MODEL]);
  await pg.query("insert into directory_customers (name) values ($1), ($2)", [OLD, NEW]);
  await pg.query("insert into desk_accounts (user_id, username, approved) values ('u_sam', 'sam.zz', true)");
  const unit = async (customer, serial) =>
    (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, $3, $4) returning id",
        [customer, MODEL, serial, P.serialKey(serial)],
      )
    ).rows[0].id;
  const install = async (customer, wo = "1120") =>
    (await pg.query("insert into installs (customer, equipment, wo) values ($1, $2, $3) returning id", [customer, MODEL, wo])).rows[0].id;
  const units = async (customer) =>
    (await pg.query("select id, serial from account_equipment where lower(customer) = lower($1) order by id", [customer])).rows.map((r) => r.serial);
  const installRow = async (id) => (await pg.query("select serial, machines, serial_notice from installs where id = $1", [id])).rows[0];
  const pull = (data) => P.pullSerial(sql, "u_sam", data);
  return { pg, sql, unit, install, units, installRow, pull };
}

test("a serial on another account's machines asks to move it, and writes nothing until the answer is yes", async () => {
  const { pg, unit, install, units, installRow, pull } = await fresh();
  try {
    await unit(OLD, "ZZITCB167321");
    const id = await install(NEW);
    const before = await installRow(id);
    const asked = await pull({ serial: "zzitcb 167321", installId: id, machineIndex: 0 });
    assert.equal(asked.needsConfirm, true);
    assert.equal(asked.moveFrom, OLD);
    assert.equal(asked.notice, `Serial ZZITCB167321 is on ${OLD}'s inventory.`);
    assert.equal(asked.pulled, false);
    // Cancel is not sending the yes: both records are as they were.
    assert.deepEqual(await units(OLD), ["ZZITCB167321"]);
    assert.deepEqual(await installRow(id), before);
    // A yes for some other account is not a yes for this one.
    const other = await pull({ serial: "ZZITCB167321", installId: id, machineIndex: 0, moveFrom: "ZZ Somewhere Else" });
    assert.equal(other.needsConfirm, true);
    assert.deepEqual(await units(OLD), ["ZZITCB167321"]);
    assert.deepEqual(await installRow(id), before);
  } finally {
    await pg.close();
  }
});

test("Move takes the unit off the old account as Remove does, puts the serial on the install, and notes it on both", async () => {
  const { pg, sql, unit, install, units, installRow, pull } = await fresh();
  try {
    const uid = await unit(OLD, "ZZITCB167321");
    await unit(OLD, "ZZITCB999000");
    const id = await install(NEW);
    const moved = await pull({ serial: "ZZITCB167321", installId: id, machineIndex: 0, moveFrom: OLD.toUpperCase() });
    assert.equal(moved.needsConfirm, false);
    assert.equal(moved.notice, `Serial ZZITCB167321 moved from ${OLD} to this install · ${MODEL}`);
    // Off the old account, and only that unit.
    assert.deepEqual(await units(OLD), ["ZZITCB999000"]);
    // On its Retired list, with the move noted, and nothing deleted outright.
    const retired = await listRetiredUnits(sql, OLD);
    assert.equal(retired.length, 1);
    assert.equal(retired[0].unitId, uid);
    assert.equal(retired[0].retiredName, "sam.zz");
    assert.match(retired[0].movedNote, new RegExp(`^Moved from ${OLD} to install WO-1120 by sam\\.zz \\d{1,2}/\\d{1,2}/\\d{4}$`));
    // On the install: the serial on the row, the notice, and the same note in its history.
    const row = await installRow(id);
    assert.match(row.serial ?? "", /ZZITCB167321/);
    assert.match(row.machines ?? "", /ZZITCB167321/);
    assert.equal(row.serial_notice, moved.notice);
    const log = (await pg.query("select action, detail from activity where entity_type = 'install' and entity_id = $1", [id])).rows;
    assert.equal(log.length, 1);
    assert.equal(log[0].action, "moved-serial");
    assert.ok(log[0].detail.startsWith(retired[0].movedNote));
    // Put back still works, before the install is marked Installed.
    await putBackEquipmentUnit(sql, retired[0].id);
    assert.deepEqual(await units(OLD), ["ZZITCB167321", "ZZITCB999000"]);
  } finally {
    await pg.close();
  }
});

test("a unit that can't be removed is not moved, and the install's list is left as it was", async () => {
  const { pg, unit, install, units, installRow, pull } = await fresh();
  try {
    const uid = await unit(OLD, "ZZITCB167321");
    await pg.query("update account_equipment set locked_at = now(), locked_by = 'someone' where id = $1", [uid]);
    const id = await install(NEW);
    const before = await installRow(id);
    await assert.rejects(pull({ serial: "ZZITCB167321", installId: id, machineIndex: 0, moveFrom: OLD }));
    assert.deepEqual(await units(OLD), ["ZZITCB167321"]);
    assert.deepEqual(await installRow(id), before);
    assert.equal((await pg.query("select count(*)::int as n from account_equipment_retired")).rows[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("a retired unit holds no serial: the install isn't asked to move it", async () => {
  const { pg, sql, unit, install, pull } = await fresh();
  try {
    const uid = await unit(OLD, "ZZITCB167321");
    await removeEquipmentUnit(sql, uid, { userId: "u_sam", name: "sam.zz" });
    const id = await install(NEW);
    const res = await pull({ serial: "ZZITCB167321", installId: id, machineIndex: 0 });
    assert.equal(res.needsConfirm, false);
    assert.equal(res.moveFrom ?? null, null);
    assert.doesNotMatch(res.notice, /inventory/);
  } finally {
    await pg.close();
  }
});

test("a serial on this account and on another one is this account's unit; nothing is moved", async () => {
  const { pg, unit, install, units, pull } = await fresh();
  try {
    await unit(OLD, "ZZITCB167321");
    await unit(NEW, "ZZITCB167321");
    const id = await install(NEW);
    const res = await pull({ serial: "ZZITCB167321", installId: id, machineIndex: 0 });
    assert.equal(res.needsConfirm, false);
    assert.equal(res.alreadyHere, true);
    assert.match(res.notice, /already on this account/);
    assert.deepEqual(await units(OLD), ["ZZITCB167321"]);
  } finally {
    await pg.close();
  }
});

test("a ticket still only says the serial is on another account, and moves nothing", async () => {
  const { pg, unit, units, pull } = await fresh();
  try {
    await unit(OLD, "ZZITCB167321");
    const jobId = (await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', 'ZZ-1', $1) returning id", [NEW])).rows[0].id;
    const res = await pull({ serial: "ZZITCB167321", jobId, moveFrom: OLD });
    assert.equal(res.needsConfirm, false);
    assert.equal(res.notice, `Serial ZZITCB167321 is on ${OLD}'s inventory — not moved.`);
    assert.deepEqual(await units(OLD), ["ZZITCB167321"]);
  } finally {
    await pg.close();
  }
});

test("a warehouse unit on a service ticket still gets the Reuse prompt, and Reuse pulls it as before", async () => {
  const { pg, install, pull } = await fresh();
  try {
    const jobId = (await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', 'ZZ-2', 'ZZ Bench Customer') returning id")).rows[0].id;
    const assetId = (
      await pg.query(
        "insert into assets (kind, model, qty, site, status, serial, job_id, sold_to) values ('equip', $1, 1, 'field', 'assigned', 'ZZBENCH42', $2, 'ZZ Bench Customer') returning id",
        [MODEL, jobId],
      )
    ).rows[0].id;
    const id = await install(NEW);
    const asked = await pull({ serial: "ZZBENCH42", installId: id, machineIndex: 0 });
    assert.equal(asked.needsConfirm, true);
    assert.equal(asked.moveFrom ?? null, null);
    assert.match(asked.notice, /already assigned to ZZ Bench Customer/);
    const reused = await pull({ serial: "ZZBENCH42", installId: id, machineIndex: 0, confirmReuse: true });
    assert.equal(reused.pulled, true);
    const a = (await pg.query("select install_id, job_id, sold_to from assets where id = $1", [assetId])).rows[0];
    assert.deepEqual([a.install_id, a.job_id, a.sold_to], [id, null, NEW]);
  } finally {
    await pg.close();
  }
});

test("a stored 'not moved' notice stops showing once the old account no longer has the serial", async () => {
  const { pg, sql, unit } = await fresh();
  try {
    const gone = await unit(OLD, "ZZITCB167321");
    await unit(OLD, "ZZITCB555");
    await removeEquipmentUnit(sql, gone, { userId: "u_sam", name: "sam.zz" });
    const rows = [
      { id: 1, serialNotice: P.notMovedNotice("ZZITCB167321", OLD) },
      { id: 2, serialNotice: P.notMovedNotice("ZZITCB555", OLD) },
      { id: 3, serialNotice: P.notMovedNotice("ZZITCB555", "ZZ Another Account") },
      { id: 4, serialNotice: "Serial ZZX not found in warehouse." },
      { id: 5, serialNotice: null },
    ];
    const live = await P.withLiveSerialNotices(sql, rows);
    assert.deepEqual(
      live.map((r) => r.serialNotice),
      [null, rows[1].serialNotice, null, rows[3].serialNotice, null],
    );
    // The stored text is not changed: this only reads.
    assert.equal(rows[0].serialNotice, P.notMovedNotice("ZZITCB167321", OLD));
  } finally {
    await pg.close();
  }
});

test("every install read drops a stale notice", () => {
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  const maps = api.match(/mapInstall\((r|rows\[0\]|\(await sql`select \* from installs where id = \$\{data\.id\}`\)\[0\]), /g) ?? [];
  const wrapped = api.match(/withLiveSerialNotices\(sql, /g) ?? [];
  assert.equal(maps.length, 5);
  assert.equal(wrapped.length, maps.length);
});

test("the WO in the move note reads the way Corrigo writes it", () => {
  const when = new Date("2026-11-17T19:49:00Z");
  assert.equal(P.movedNote(OLD, 7, "1120", "sam.zz", when), `Moved from ${OLD} to install WO-1120 by sam.zz 11/17/2026`);
  assert.equal(P.movedNote(OLD, 7, "WO-0855", "sam.zz", when), `Moved from ${OLD} to install WO-0855 by sam.zz 11/17/2026`);
  assert.equal(P.movedNote(OLD, 7, null, "sam.zz", when), `Moved from ${OLD} to install #7 by sam.zz 11/17/2026`);
});
