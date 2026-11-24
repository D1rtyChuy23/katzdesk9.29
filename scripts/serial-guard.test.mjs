// No new duplicate serials (Chuy, 11/23): migration 0137 refuses a customer machine with a serial another customer
// machine has, and a warehouse record with a serial another unsold warehouse record has. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const AE = await import("../src/lib/ops/account-equip.ts");
const { serialClashMessage, SERIAL_CLASH_CODE } = await import("../src/lib/ops/serial-guard.ts");

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  return { pg, q };
}
const unit = (q, customer, name, serial, key = AE.serialKey(serial) || null) =>
  q("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, 'Zz Grinder', $2, $3, $4) returning id", [customer, name, serial, key]);
const asset = (q, serial, status = "ready") =>
  q("insert into assets (kind, model, serial, site, status) values ('equip', 'Zz Grinder', $1, 'Barn', $2) returning id", [serial, status]);
async function refused(p) {
  try {
    await p;
  } catch (e) {
    assert.ok(serialClashMessage(e), `not the serial refusal: ${e.message}`);
    assert.equal(e.code, SERIAL_CLASH_CODE);
    return e.message;
  }
  assert.fail("the save was not refused");
}

test("a customer machine with a serial another customer machine has is refused, naming where it is", async () => {
  const { pg, q } = await db();
  try {
    await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    const msg = await refused(unit(q, "Zz Cafe B", "Grinder #9", "zz-100"));
    assert.match(msg, /^Serial zz-100 is already on Zz Cafe A \(Grinder #1\)\.$/i);
    // On the same account too.
    await refused(unit(q, "Zz Cafe A", "Grinder #2", "zz-100 #"));
    assert.equal((await q("select count(*)::int as n from account_equipment"))[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("an edit that gives a machine another's serial is refused; other edits and serial changes save", async () => {
  const { pg, q } = await db();
  try {
    await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    const [b] = await unit(q, "Zz Cafe B", "Grinder #2", "ZZ-200");
    await refused(q("update account_equipment set serial = 'ZZ-100', serial_key = 'zz-100' where id = $1", [b.id]));
    await q("update account_equipment set equipment_name = 'Front grinder' where id = $1", [b.id]);
    await q("update account_equipment set serial = 'ZZ-300', serial_key = 'zz-300' where id = $1", [b.id]);
    assert.equal((await q("select serial from account_equipment where id = $1", [b.id]))[0].serial, "ZZ-300");
  } finally {
    await pg.close();
  }
});

test("a serial written without its key is still matched", async () => {
  const { pg, q } = await db();
  try {
    await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    await refused(unit(q, "Zz Cafe B", "Grinder #2", " zz-100 ", null));
  } finally {
    await pg.close();
  }
});

test("placeholders and short serials are no serial: never refused", async () => {
  const { pg, q } = await db();
  try {
    for (const s of ["N/A", "none", "-", "12"]) {
      await unit(q, "Zz Cafe A", "Grinder", s, s.toLowerCase());
      await unit(q, "Zz Cafe B", "Grinder", s, s.toLowerCase());
    }
    await unit(q, "Zz Cafe A", "Grinder", null, null);
    await unit(q, "Zz Cafe B", "Grinder", null, null);
  } finally {
    await pg.close();
  }
});

test("a duplicate already there is left: edits that keep its serial save; one that moves it onto a third serial in use is refused", async () => {
  const { pg, q } = await db();
  try {
    await pg.exec("set session_replication_role = replica");
    await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    const [dup] = await unit(q, "Zz Cafe B", "Grinder #2", "ZZ-100");
    await pg.exec("set session_replication_role = origin");
    await q("update account_equipment set equipment_name = 'Renamed', serial = 'ZZ 100' where id = $1", [dup.id]);
    await unit(q, "Zz Cafe C", "Grinder #3", "ZZ-300");
    await refused(q("update account_equipment set serial = 'ZZ-300', serial_key = 'zz-300' where id = $1", [dup.id]));
  } finally {
    await pg.close();
  }
});

test("one statement that takes a serial off one machine and puts it on another passes (checked when the save commits)", async () => {
  const { pg, q } = await db();
  try {
    const [a] = await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    await q(
      `with gone as (delete from account_equipment where id = $1 returning serial, serial_key)
       insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key)
       select 'Zz Cafe B', 'Zz Grinder', 'Grinder #1', serial, serial_key from gone`,
      [a.id],
    );
    assert.deepEqual((await q("select customer from account_equipment")).map((r) => r.customer), ["Zz Cafe B"]);
    // Two statements in one transaction, the new one first: also fine at commit.
    await pg.transaction(async (tx) => {
      await tx.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Zz Cafe C', 'Zz Grinder', 'G', 'ZZ-100', 'zz-100')");
      await tx.query("delete from account_equipment where customer = 'Zz Cafe B'");
    });
    assert.deepEqual((await q("select customer from account_equipment")).map((r) => r.customer), ["Zz Cafe C"]);
  } finally {
    await pg.close();
  }
});

test("a retired machine's serial can go on another machine; Put back is then refused", async () => {
  const { pg, q } = await db();
  try {
    const [a] = await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    await q("delete from account_equipment where id = $1", [a.id]);
    await unit(q, "Zz Cafe B", "Grinder #1", "ZZ-100");
    await refused(q("insert into account_equipment (id, customer, catalog_model, equipment_name, serial, serial_key) values ($1, 'Zz Cafe A', 'Zz Grinder', 'Grinder #1', 'ZZ-100', 'zz-100')", [a.id]));
  } finally {
    await pg.close();
  }
});

test("warehouse: a serial another unsold record has is refused; a sold record is history", async () => {
  const { pg, q } = await db();
  try {
    const [sold] = await asset(q, "WH-500", "sold");
    await asset(q, "wh-500");
    const msg = await refused(asset(q, " WH-500# ", "deployed"));
    assert.match(msg, /^Serial WH-500# is already on warehouse record #\d+ \(Zz Grinder, ready at Barn\)\.$/);
    // A sold record back into stock while another record holds it.
    await refused(q("update assets set status = 'ready' where id = $1", [sold.id]));
    // A record marked sold, then a new one: fine.
    await q("update assets set status = 'sold' where serial = 'wh-500'");
    await asset(q, "WH-500");
    // "WH 500" is another serial than "WH-500" (dashes count, as the desk matches).
    await asset(q, "WH 500");
    // Moving a record between ready and deployed doesn't change its serial: never refused.
    await q("update assets set status = 'deployed' where status = 'ready'");
  } finally {
    await pg.close();
  }
});

test("warehouse vs customer machine with the same serial is not refused", async () => {
  const { pg, q } = await db();
  try {
    await asset(q, "ZZ-100", "deployed");
    await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    await asset(q, "ZZ-777");
    await unit(q, "Zz Cafe A", "Grinder #2", "ZZ-777");
  } finally {
    await pg.close();
  }
});

test("serial cleanup leaves a unit whose cleaned serial another unit has, and writes the rest", async () => {
  const { pg, q } = await db();
  try {
    const { applySerialNormalizeFor } = await import("../src/lib/ops/serial-normalize.ts");
    await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
    await unit(q, "Zz Cafe A", "Grinder #1", "ZZ-100");
    await pg.exec("set session_replication_role = replica");
    const [stale] = await unit(q, "Zz Cafe B", "Grinder #2", "zz-100", "stale-key");
    await pg.exec("set session_replication_role = origin");
    const [ok] = await unit(q, "Zz Cafe B", "Grinder #3", "zz-555", "old-555");
    const sql = { query: q };
    const stored = async (id) => (await q("select serial from account_equipment where id = $1", [id]))[0].serial;
    const r = await applySerialNormalizeFor(sql, "zz-admin", { rows: [{ unitId: stale.id, oldSerial: await stored(stale.id) }, { unitId: ok.id, oldSerial: await stored(ok.id) }] });
    // The stale unit's cleaned key is the one Zz Cafe A has: left as it was. The other is written.
    assert.deepEqual(r.written, [ok.id]);
    assert.equal((await q("select serial_key from account_equipment where id = $1", [stale.id]))[0].serial_key, "stale-key");
  } finally {
    await pg.close();
  }
});

test("serialClashMessage reads the refusal and nothing else", () => {
  assert.equal(serialClashMessage({ code: "KZ001", message: "Serial X is already on Y (Z)." }), "Serial X is already on Y (Z).");
  assert.equal(serialClashMessage(new Error("Serial ZZ-1 is already on Zz Cafe (G).")), "Serial ZZ-1 is already on Zz Cafe (G).");
  assert.equal(serialClashMessage(new Error("duplicate key value violates unique constraint")), null);
  assert.equal(serialClashMessage(null), null);
});

test("serial cleanup catches the refusal per unit", () => {
  const src = readFileSync(new URL("../src/lib/ops/serial-normalize.ts", import.meta.url), "utf8");
  assert.match(src, /if \(serialClashMessage\(e\)\) continue;/);
});
