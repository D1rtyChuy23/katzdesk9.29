// Serials match whatever their case or spacing (Chuy, 11/19: "ITCB154148" in the Equipment List file against
// "Itcb154148" on the account must update the unit, never add a second one). An invisible character pasted in with a
// serial doesn't stop a match either. New serials are stored uppercase; existing ones change only through the Admin's
// previewed Normalize, and only once it is applied. Made-up accounts.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const A = await import("../src/lib/ops/account-equip.ts");
const P = await import("../src/lib/ops/serial-pull.ts");
const N = await import("../src/lib/ops/serial-normalize.ts");

const LOPEZ = "ZZ Lopez Cafe";
const MODEL = "Bunn ITCB-DV";

test("a serial's key ignores case, spaces, # and invisible characters, the same in every place that keys one", () => {
  const same = ["ITCB154148", "Itcb154148", " itcb 154148 ", "#ITCB154148", "ITCB​154148", "﻿ITCB154148", "ＩＴＣＢ154148"];
  for (const s of same) {
    assert.equal(A.serialKey(s), "itcb154148", JSON.stringify(s));
    assert.equal(P.serialKey(s), "itcb154148", JSON.stringify(s));
  }
  assert.notEqual(A.serialKey("ITCB154149"), "itcb154148");
});

test("the Equipment List import updates the unit whose serial differs only in case or spacing; it never adds a second one", () => {
  const existing = [{ id: 7, customer: LOPEZ, catalogModel: MODEL, equipmentName: MODEL, serial: "Itcb154148", serialKey: "itcb154148", lockedBy: null }];
  for (const serial of ["ITCB154148", "itcb154148", "ITCB 154148", "ITCB​154148"]) {
    assert.deepEqual(A.matchExistingUnit({ customer: LOPEZ, catalogModel: MODEL, equipmentName: MODEL, serial, existing }), { action: "update", existingId: 7, foreignAccount: null, matchKind: "same-serial" }, serial);
  }
  // On another account: asked about, not added.
  assert.equal(A.matchExistingUnit({ customer: "ZZ Somewhere Else", catalogModel: MODEL, equipmentName: MODEL, serial: "ITCB154148", existing }).action, "review");
});

test("a serial typed or imported is kept uppercase", () => {
  assert.equal(A.parseSerial(" itcb154148 "), "ITCB154148");
  assert.equal(A.parseSerial("itcb​154148"), "ITCB154148");
  assert.equal(A.parseSerial("n/a"), null);
});

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u_boss', 'boss.zz', true, true), ('u_tech', 'tech.zz', true, false)");
  const sql = { query: async (t, p) => (await pg.query(t, p)).rows };
  return { pg, sql };
}

test("a unit written with a lowercase serial is stored uppercase; an unrelated edit leaves an old serial as it was", async () => {
  const { pg } = await fresh();
  try {
    const id = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, ' itcb076334 ', 'itcb076334') returning id", [LOPEZ, MODEL])).rows[0].id;
    assert.equal((await pg.query("select serial from account_equipment where id = $1", [id])).rows[0].serial, "ITCB076334");
    // An old mixed-case serial, as production has, written before this rule: an edit of another field leaves it.
    await pg.query("alter table account_equipment disable trigger account_equipment_serial_upper");
    const old = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, 'Itcb154148', 'itcb154148') returning id", [LOPEZ, MODEL])).rows[0].id;
    await pg.query("alter table account_equipment enable trigger account_equipment_serial_upper");
    await pg.query("update account_equipment set condition = 'Good' where id = $1", [old]);
    assert.equal((await pg.query("select serial from account_equipment where id = $1", [old])).rows[0].serial, "Itcb154148");
  } finally {
    await pg.close();
  }
});

test("Normalize serials: Admin only, the preview lists every change and writes nothing, Apply writes only what was previewed", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("alter table account_equipment disable trigger account_equipment_serial_upper");
    const add = async (serial, key, customer = LOPEZ) =>
      (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, $3, $4) returning id", [customer, MODEL, serial, key])).rows[0].id;
    const a = await add("Itcb154148", "itcb154148");
    const b = await add("ITCB 076334", null);
    const c = await add("ITCB083077", "itcb083077");
    const d = await add("itcb​999", "itcb​999");
    // Another account has the same serial as d's, once d's key is cleaned: flagged, not hidden.
    await add("ITCB999", "itcb999", "ZZ Two Step Tacos");
    await pg.query("alter table account_equipment enable trigger account_equipment_serial_upper");
    await assert.rejects(N.previewSerialNormalizeFor(sql, "u_tech"), new RegExp(N.NORMALIZE_ADMIN_ONLY));
    const before = (await pg.query("select id, serial, serial_key from account_equipment order by id")).rows;
    const p = await N.previewSerialNormalizeFor(sql, "u_owner_missing").catch(() => null);
    assert.equal(p, null);
    const preview = await N.previewSerialNormalizeFor(sql, "u_boss");
    assert.deepEqual(
      preview.rows.map((r) => [r.unitId, r.oldSerial, r.newSerial, r.oldKey, r.newKey]),
      [
        [a, "Itcb154148", "ITCB154148", "itcb154148", "itcb154148"],
        [b, "ITCB 076334", "ITCB 076334", null, "itcb076334"],
        [d, "itcb​999", "ITCB999", "itcb​999", "itcb999"],
      ],
    );
    assert.equal(preview.rows.some((r) => r.unitId === c), false);
    assert.deepEqual(preview.rows.find((r) => r.unitId === d).alsoOn, ["ZZ Two Step Tacos"]);
    assert.deepEqual((await pg.query("select id, serial, serial_key from account_equipment order by id")).rows, before);
    // A serial changed after the preview is left as it was.
    await pg.query("update account_equipment set serial = 'ITCB154148X', serial_key = 'itcb154148x' where id = $1", [a]);
    const res = await N.applySerialNormalizeFor(sql, "u_boss", { rows: preview.rows.map((r) => ({ unitId: r.unitId, oldSerial: r.oldSerial })) });
    assert.deepEqual(res.written.sort((x, y) => x - y), [b, d]);
    const after = Object.fromEntries((await pg.query("select id, serial, serial_key from account_equipment")).rows.map((r) => [r.id, [r.serial, r.serial_key]]));
    assert.deepEqual(after[a], ["ITCB154148X", "itcb154148x"]);
    assert.deepEqual(after[b], ["ITCB 076334", "itcb076334"]);
    assert.deepEqual(after[d], ["ITCB999", "itcb999"]);
  } finally {
    await pg.close();
  }
});

test("the model picker won't add text that looks like a serial as a new model without asking", async () => {
  for (const s of ["ITCB154148", "itcb154148", "PB001708", "231515042", "SN:231515042", "SN 12345"]) assert.equal(A.looksLikeSerial(s), true, s);
  for (const m of ["Bunn ITCB-DV", "TB3", "G9-2T", "Fetco CBS-51H", "Mazzer Super Jolly", "Eversys Cameo C2", "Bunn 33200.0000"]) assert.equal(A.looksLikeSerial(m), false, m);
  const { pg, sql } = await fresh();
  try {
    const api = await import("../src/lib/ops/api.ts");
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, 'LPG-0080607', 'lpg-0080607')", [LOPEZ, MODEL]);
    // A typed model that is an existing unit's serial, or reads as one, is asked about; with the yes it is added.
    await assert.rejects(api.addDirectoryEntryFor(sql, { kind: "equipment", name: "ITCB154148" }), new RegExp(A.SERIAL_LIKE_MODEL_PREFIX));
    await assert.rejects(api.addDirectoryEntryFor(sql, { kind: "equipment", name: "lpg-0080607" }), new RegExp(A.SERIAL_LIKE_MODEL_PREFIX));
    assert.equal((await pg.query("select count(*)::int as n from directory_equipment where lower(name) in ('itcb154148', 'lpg-0080607')")).rows[0].n, 0);
    await api.addDirectoryEntryFor(sql, { kind: "equipment", name: "ITCB154148", confirmSerialLike: true });
    assert.equal((await pg.query("select count(*)::int as n from directory_equipment where name = 'ITCB154148'")).rows[0].n, 1);
    // A real model goes in as before.
    await api.addDirectoryEntryFor(sql, { kind: "equipment", name: "Fetco CBS-51H" });
    assert.equal((await pg.query("select count(*)::int as n from directory_equipment where name = 'Fetco CBS-51H'")).rows[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("Normalize leaves placeholder serials such as N/A alone: no key, no duplicate flag", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("alter table account_equipment disable trigger account_equipment_serial_upper");
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, 'N/A', null), ('ZZ Other', $2, $2, 'n/a', null)", [LOPEZ, MODEL]);
    await pg.query("alter table account_equipment enable trigger account_equipment_serial_upper");
    const p = await N.previewSerialNormalizeFor(sql, "u_boss");
    assert.deepEqual(p.rows, []);
    const res = await N.applySerialNormalizeFor(sql, "u_boss", { rows: [{ unitId: 1, oldSerial: "N/A" }] });
    assert.deepEqual(res.written, []);
    assert.deepEqual((await pg.query("select serial_key from account_equipment order by id")).rows.map((r) => r.serial_key), [null, null]);
  } finally {
    await pg.close();
  }
});
