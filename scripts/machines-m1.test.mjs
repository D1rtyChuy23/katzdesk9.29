// One Record Per Machine, phase M1 (Chuy approved 11/24): a `machines` table, with every account unit, retired unit and
// warehouse machine record linked to one (migrations 0143 and 0144). Each serial is one machine (the desk's serial key
// from 0137); each unit with no serial is its own. Bulk stock and warehouse modules stay off it. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
const M1 = "0143_machines_m1.sql";

async function beforeM1() {
  const pg = new PGlite();
  for (const f of files.filter((f) => f < M1)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  const runM1 = async () => {
    for (const f of files.filter((f) => f >= M1)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  };
  return { pg, q, runM1, sql: { query: q } };
}
async function all() {
  const b = await beforeM1();
  await b.runM1();
  return b;
}
const unit = async (q, serial, customer = "Zz Cafe") =>
  (await q("insert into account_equipment (customer, catalog_model, equipment_name, serial) values ($1, 'Zz Brewer', 'Zz Brewer', $2) returning *", [customer, serial]))[0];
const asset = async (q, serial, o = {}) =>
  (await q("insert into assets (kind, model, site, serial, qty, status) values ($1, 'Zz Grinder', 'Barn', $2, $3, $4) returning *", [o.kind ?? "equip", serial, o.qty ?? 1, o.status ?? "ready"]))[0];
const retired = async (q, serial, unitId) =>
  (await q("insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, serial, unit) values ($1, 'Zz Cafe', 'Zz Brewer', 'Zz Brewer', $2, '{}') returning *", [unitId, serial]))[0];
const machineOf = async (q, table, id) => (await q(`select machine_id from ${table} where id = $1`, [id]))[0].machine_id;
const machineCount = async (q) => (await q("select count(*)::int as n from machines"))[0].n;

test("the backfill: one machine per serial, one per unit with no serial; bulk and modules left off; nothing else changes", async () => {
  const { pg, q, runM1 } = await beforeM1();
  try {
    const a1 = await unit(q, "SN-A100");
    // The same serial key in other capitals and with a space: old data from before 0137, which refuses it now.
    await q("alter table account_equipment disable trigger account_equipment_serial_guard");
    const a2 = await unit(q, " sn-A100", "Zz Other");
    await q("alter table account_equipment enable trigger account_equipment_serial_guard");
    const a3 = await unit(q, null);
    const a4 = await unit(q, "N/A"); // a placeholder: no serial
    const w1 = await asset(q, "SN-A100", { status: "sold" }); // the account's machine, sold earlier
    await asset(q, "SN-B200");
    const w3 = await asset(q, null);
    const w4 = await asset(q, null, { qty: 5 }); // bulk
    const w5 = await asset(q, "MOD-1", { kind: "module" });
    const w6 = await asset(q, "SN-D400", { kind: "dispenser" });
    const r1 = await retired(q, "SN-C300", 9001);
    const r2 = await retired(q, null, 9002);
    const before = {
      a: await q("select * from account_equipment order by id"),
      w: await q("select * from assets order by id"),
      r: await q("select * from account_equipment_retired order by id"),
    };
    const history = (await q("select count(*)::int as n from equipment_history"))[0].n;
    await runM1();

    const m = async (t, r) => machineOf(q, t, r.id);
    const A = await m("account_equipment", a1);
    assert.ok(A);
    assert.equal(await m("account_equipment", a2), A, "the same serial key is one machine");
    assert.equal(await m("assets", w1), A, "a sold warehouse record and the account unit with its serial are one machine");
    const own = [await m("account_equipment", a3), await m("account_equipment", a4), await m("assets", w3), await m("account_equipment_retired", r2)];
    assert.equal(new Set(own).size, 4, "each unit with no serial is its own machine");
    assert.ok(own.every((id) => id && id !== A));
    assert.equal(await m("assets", w4), null, "bulk stock has no machine");
    assert.equal(await m("assets", w5), null, "a warehouse module has no machine (modules are their own records)");
    assert.ok(await m("assets", w6), "a dispenser is a machine");
    assert.ok(await m("account_equipment_retired", r1));
    // Serials A, B, C, D, plus four units with no serial.
    assert.equal(await machineCount(q), 8);
    const [ma] = await q("select serial, serial_key, model, origin_table, origin_id from machines where id = $1", [A]);
    assert.deepEqual(ma, { serial: "SN-A100", serial_key: "sn-a100", model: "Zz Brewer", origin_table: "account_equipment", origin_id: a1.id });

    const strip = (rows) => rows.map(({ machine_id: _machine, ...r }) => r);
    assert.deepEqual(strip(await q("select * from account_equipment order by id")), before.a);
    assert.deepEqual(strip(await q("select * from assets order by id")), before.w);
    assert.deepEqual(strip(await q("select * from account_equipment_retired order by id")), before.r);
    assert.equal((await q("select count(*)::int as n from equipment_history"))[0].n, history, "no equipment history is written");
  } finally {
    await pg.close();
  }
});

test("new records link as they're saved: a known serial finds its machine, a new one makes one", async () => {
  const { pg, q } = await all();
  try {
    const w = await asset(q, "SN-B200");
    const u = await unit(q, "sn-b200"); // deployed from the warehouse
    assert.ok(w.machine_id);
    assert.equal(u.machine_id, w.machine_id);
    const n = await unit(q, "SN-NEW9");
    assert.ok(n.machine_id && n.machine_id !== w.machine_id);
    const x = await unit(q, null);
    const y = await unit(q, "");
    assert.ok(x.machine_id && y.machine_id && x.machine_id !== y.machine_id);
    assert.equal((await asset(q, null, { qty: 4 })).machine_id, null);
  } finally {
    await pg.close();
  }
});

test("editing a serial: a typo fix keeps the machine; another machine's serial moves to it; clearing it leaves that machine", async () => {
  const { pg, q } = await all();
  try {
    const u = await unit(q, "SN-TYPO1");
    const mine = u.machine_id;
    await q("update account_equipment set serial = 'SN-FIXED1', serial_key = null where id = $1", [u.id]);
    assert.equal(await machineOf(q, "account_equipment", u.id), mine, "only this unit had it: the machine stays, with the new serial");
    assert.equal((await q("select serial_key from machines where id = $1", [mine]))[0].serial_key, "sn-fixed1");

    const w = await asset(q, "SN-SHARED");
    await q("update account_equipment set serial = 'SN-SHARED', serial_key = null where id = $1", [u.id]);
    assert.equal(await machineOf(q, "account_equipment", u.id), w.machine_id);

    // Clearing a serial says it isn't this unit's: the unit leaves that serial's machine for one of its own. This is how
    // the install machine list moves a serial typed on the wrong row to the right one.
    const wrong = await unit(q, "SN-WRONGROW");
    const right = await unit(q, null);
    await q("update account_equipment set serial = null, serial_key = null where id = $1", [wrong.id]);
    await q("update account_equipment set serial = 'SN-WRONGROW', serial_key = null where id = $1", [right.id]);
    const wrongNow = await machineOf(q, "account_equipment", wrong.id);
    assert.equal(await machineOf(q, "account_equipment", right.id), wrong.machine_id, "the serial's machine goes with the serial");
    assert.ok(wrongNow && wrongNow !== wrong.machine_id, "the unit it was cleared on has its own machine");
    assert.equal((await q("select serial_key from machines where id = $1", [wrongNow]))[0].serial_key, null);
    // A unit already on a machine with no serial keeps it.
    const plain = await unit(q, null);
    await q("update account_equipment set serial = '', serial_key = null where id = $1", [plain.id]);
    assert.equal(await machineOf(q, "account_equipment", plain.id), plain.machine_id);
    // A warehouse record that becomes bulk, or a module, leaves the machine list.
    const b = await asset(q, "SN-BULKME");
    await q("update assets set qty = 3, serial = null where id = $1", [b.id]);
    assert.equal(await machineOf(q, "assets", b.id), null);
  } finally {
    await pg.close();
  }
});

test("retire and put back keep the same machine, with or without a serial", async () => {
  const { pg, q } = await all();
  try {
    const { retireUnitSql, restoreUnitSql } = await import("../src/lib/ops/account-equip-retire.ts");
    for (const serial of [null, "SN-RET1"]) {
      const u = await unit(q, serial);
      const [r] = await q(retireUnitSql(), [u.id, "zz", "Zz", null]);
      assert.equal(await machineOf(q, "account_equipment_retired", r.id), u.machine_id, `retired ${serial}`);
      await q("delete from account_equipment where id = $1", [u.id]);
      await q(restoreUnitSql(), [r.id, "Zz Cafe"]);
      assert.equal(await machineOf(q, "account_equipment", u.id), u.machine_id, `put back ${serial}`);
    }
  } finally {
    await pg.close();
  }
});

test("putting a unit back on an install keeps its machine", async () => {
  const { pg, q } = await all();
  try {
    const { keepRemovedSql, putBackInstallUnitSql } = await import("../src/lib/ops/inspection-api.ts");
    const [inst] = await q("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id");
    const u = await unit(q, null);
    await q("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [inst.id, u.id]);
    await q(keepRemovedSql(), [inst.id, u.id, "{}"]);
    const [removed] = await q("select id from install_units_removed where unit_id = $1", [u.id]);
    await q("delete from install_inspection_units where equipment_id = $1", [u.id]);
    await q("delete from account_equipment where id = $1", [u.id]);
    await q(putBackInstallUnitSql(), [removed.id, "zz"]);
    assert.equal(await machineOf(q, "account_equipment", u.id), u.machine_id);
  } finally {
    await pg.close();
  }
});

test("Link Check shows the machine counts, and the expected count matches", async () => {
  const { pg, q, sql } = await all();
  try {
    await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
    await unit(q, "SN-A100");
    await asset(q, "SN-A100", { status: "sold" });
    await unit(q, null);
    await asset(q, null, { qty: 5 });
    await retired(q, "SN-C300", 9001);
    const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");
    const r = await linkCheckFor(sql, "zz-admin");
    assert.deepEqual(r.machines.machines, { total: 3, withSerial: 2, noSerial: 1, empty: 0, merged: 0, expected: 3, unlinked: { account: 0, retired: 0, warehouse: 0 }, offSerial: 0 });
  } finally {
    await pg.close();
  }
});

test("review: a typo fixed on both records of a deployed machine ends on one machine, the old one marked merged into it", async () => {
  const { pg, q } = await all();
  try {
    const w = await asset(q, "SN-TYPO", { status: "sold" });
    const u = await unit(q, "SN-TYPO");
    const old = u.machine_id;
    assert.equal(w.machine_id, old);
    await q("update account_equipment set serial = 'SN-RIGHT', serial_key = null where id = $1", [u.id]);
    await q("update assets set serial = 'SN-RIGHT' where id = $1", [w.id]);
    const now = await machineOf(q, "account_equipment", u.id);
    assert.equal(await machineOf(q, "assets", w.id), now);
    assert.equal((await q("select merged_into from machines where id = $1", [old]))[0].merged_into, now, "the old machine points at the one its records went to");
  } finally {
    await pg.close();
  }
});

test("review: merging a duplicate with no serial puts its retired record on the kept unit's machine", async () => {
  const { pg, q } = await all();
  try {
    const { retireUnitSql } = await import("../src/lib/ops/account-equip-retire.ts");
    const keep = await unit(q, "SN-KEEP");
    const drop = await unit(q, null);
    const [r] = await q(retireUnitSql(), [drop.id, "zz", "Zz", JSON.stringify({ reason: "Merged", merged_into: keep.id, merged_serial: "SN-KEEP" })]);
    await q("delete from account_equipment where id = $1", [drop.id]);
    assert.equal(await machineOf(q, "account_equipment_retired", r.id), keep.machine_id);
    assert.equal((await q("select merged_into from machines where id = $1", [drop.machine_id]))[0].merged_into, keep.machine_id);
  } finally {
    await pg.close();
  }
});

test("review: the backfill puts a merged duplicate's retired record on the kept unit's machine", async () => {
  const { pg, q, runM1 } = await beforeM1();
  try {
    const keep = await unit(q, "SN-KEEP2");
    const [r] = await q(
      "insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, serial, unit, links) values (9100, 'Zz Cafe', 'Zz Brewer', 'Zz Brewer', 'ab', '{}', $1) returning id",
      [JSON.stringify({ merged_into: keep.id })],
    );
    await runM1();
    assert.equal(await machineOf(q, "account_equipment_retired", r.id), await machineOf(q, "account_equipment", keep.id));
    assert.equal(await machineCount(q), 1);
  } finally {
    await pg.close();
  }
});

test("review: a retire from the old code (no machine sent) keeps the unit's machine from its copy", async () => {
  const { pg, q } = await all();
  try {
    const u = await unit(q, null);
    const [r] = await q(
      "insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, serial, unit) select a.id, a.customer, a.catalog_model, a.equipment_name, a.serial, to_jsonb(a) from account_equipment a where a.id = $1 returning id",
      [u.id],
    );
    assert.equal(await machineOf(q, "account_equipment_retired", r.id), u.machine_id);
  } finally {
    await pg.close();
  }
});

test("review: the machine keeps the serial as the unit stores it; quantity edits reuse a record's machine", async () => {
  const { pg, q } = await all();
  try {
    const u = await unit(q, "sn-low1");
    const [m] = await q("select m.serial, a.serial as unit_serial from machines m join account_equipment a on a.machine_id = m.id where a.id = $1", [u.id]);
    assert.equal(m.serial, m.unit_serial);
    const w = await asset(q, null);
    for (const qty of [3, 1, 4, 1]) await q("update assets set qty = $2 where id = $1", [w.id, qty]);
    assert.equal(await machineOf(q, "assets", w.id), w.machine_id);
    assert.equal(await machineCount(q), 2);
  } finally {
    await pg.close();
  }
});

test("review: Link Check says when the machine count is off, and leaves merged machines out of empty", async () => {
  const { pg, q, sql } = await all();
  try {
    await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
    const w = await asset(q, "SN-TYPO", { status: "sold" });
    const u = await unit(q, "SN-TYPO");
    await q("update account_equipment set serial = 'SN-RIGHT', serial_key = null where id = $1", [u.id]);
    await q("update assets set serial = 'SN-RIGHT' where id = $1", [w.id]);
    await q("insert into machines (serial_key, serial, model, origin_table, origin_id) values ('zz-stray', 'ZZ-STRAY', 'x', 'assets', 0)");
    const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");
    const r = (await linkCheckFor(sql, "zz-admin")).machines.machines;
    assert.deepEqual([r.total, r.merged, r.empty, r.expected], [3, 1, 1, 1]);
  } finally {
    await pg.close();
  }
});
