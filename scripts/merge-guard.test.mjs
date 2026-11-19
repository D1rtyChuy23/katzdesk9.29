// Merge on an account's Equipment tab only for a true duplicate (Chuy, 11/19, follow-up to #167): same account and
// model, neither locked, and the serials match (any case or spaces), or one is blank or a 2-character leftover. Two
// different full serials never merge. Admin only. Recorded on the Retired list and the account's activity; Put back
// logs too. The pre-inspection's "these are one machine" keeps its own path. Made-up names and serials only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { canMergeUnits, mergeRefusal } = await import("../src/lib/ops/account-equip.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");
const { listRetiredUnits } = await import("../src/lib/ops/account-equip-retire.ts");

const SITE = "ZZ Merge Cafe";
const OTHER = "ZZ Other Diner";
const MODEL = "ZZ Brewer 2000";
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const u = (o) => ({ customer: SITE, catalogModel: MODEL, equipmentName: MODEL, serial: null, lockedBy: null, ...o });

test("canMergeUnits: matching serials (any case or spaces), a blank one, or a 2-character leftover; never two full serials", () => {
  assert.equal(canMergeUnits(u({ serial: "ZZB 1234" }), u({ serial: "zzb1234" })), true);
  assert.equal(canMergeUnits(u({ serial: "ZZB1234" }), u({ serial: null })), true);
  assert.equal(canMergeUnits(u({ serial: "" }), u({ serial: "  " })), true);
  assert.equal(canMergeUnits(u({ serial: "ZZB1234" }), u({ serial: "L" })), true);
  assert.equal(canMergeUnits(u({ serial: "Z9" }), u({ serial: "ZZB1234" })), true);
  assert.equal(canMergeUnits(u({ serial: "ZZB1234" }), u({ serial: "ZZB9999" })), false);
  assert.equal(canMergeUnits(u({ serial: "ZZB" }), u({ serial: "ZZC" })), false, "3 characters is a full serial");
  assert.match(mergeRefusal(u({ serial: "ZZB1234" }), u({ serial: "ZZB9999" })), /two different serials/i);
  assert.equal(canMergeUnits(u({}), u({ customer: OTHER })), false);
  assert.equal(canMergeUnits(u({}), u({ catalogModel: "ZZ Grinder", equipmentName: "ZZ Grinder" })), false);
  assert.equal(canMergeUnits(u({}), u({ lockedBy: "chuy" })), false);
  assert.equal(canMergeUnits(u({ customer: " zz merge cafe " }), u({})), true, "the account in any case");
});

async function fresh() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1), ($2)", [SITE, OTHER]);
  await pg.query("insert into directory_equipment (name) values ($1)", [MODEL]);
  const run = async (t, p) => (await pg.query(t, p)).rows;
  const sql = Object.assign(async (strings, ...values) => run(strings.reduce((a, x, i) => `${a}$${i}${x}`), values), { query: run });
  const unit = async (serial, o = {}) =>
    (
      await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by) values ($1, $2, $2, $3, $4, $5, $6) returning id", [
        o.customer ?? SITE,
        MODEL,
        serial,
        serial ? serial.replace(/\s+/g, "").toLowerCase() : null,
        o.locked ? new Date() : null,
        o.locked ? "chuy" : null,
      ])
    ).rows[0].id;
  return { pg, sql, unit };
}

const BOSS = { admin: true, by: { userId: "u-boss", name: "boss.zz" } };

test("the server refuses two different full serials, a non-Admin, a locked unit and another account", async () => {
  const { pg, sql, unit } = await fresh();
  try {
    const a = await unit("ZZB1234");
    const b = await unit("ZZB9999");
    await assert.rejects(IMP.mergeDuplicateUnits(sql, { keepId: a, dropId: b }, BOSS), /two different serials/i);
    const c = await unit(null);
    await assert.rejects(IMP.mergeDuplicateUnits(sql, { keepId: a, dropId: c }, { admin: false, by: { userId: "u-t", name: "tech.zz" } }), new RegExp(IMP.MERGE_ADMIN_ONLY));
    const locked = await unit("ZZB1234 ", { locked: true });
    await assert.rejects(IMP.mergeDuplicateUnits(sql, { keepId: a, dropId: locked }, BOSS), /locked/i);
    const away = await unit(null, { customer: OTHER });
    await assert.rejects(IMP.mergeDuplicateUnits(sql, { keepId: a, dropId: away }, BOSS), /same account/i);
    assert.equal((await pg.query("select count(*)::int as n from account_equipment")).rows[0].n, 5, "nothing merged");
  } finally {
    await pg.close();
  }
});

test("matching serials in another case, a blank one and a 2-character leftover merge; the merge and Put back are recorded", async () => {
  const { pg, sql, unit } = await fresh();
  try {
    const keep = await unit("ZZB 1234");
    const caseCopy = await unit("zzb1234");
    const blank = await unit(null);
    const short = await unit("L");
    await IMP.mergeDuplicateUnits(sql, { keepId: keep, dropId: caseCopy }, BOSS);
    await IMP.mergeDuplicateUnits(sql, { keepId: keep, dropId: blank }, BOSS);
    await IMP.mergeDuplicateUnits(sql, { keepId: keep, dropId: short }, BOSS);
    assert.deepEqual((await pg.query("select id from account_equipment")).rows.map((r) => r.id), [keep]);
    const retired = await listRetiredUnits(sql, SITE);
    assert.equal(retired.length, 3);
    for (const r of retired) {
      assert.equal(r.reason, "Merged into SN ZZB 1234");
      assert.equal(r.retiredName, "boss.zz");
    }
    const log = (await pg.query("select entity_type, actor_name, detail from activity order by id")).rows;
    assert.deepEqual(log, [
      { entity_type: "customer", actor_name: "boss.zz", detail: "Merged SN ZZB1234 into SN ZZB 1234" },
      { entity_type: "customer", actor_name: "boss.zz", detail: "Merged a unit with no serial into SN ZZB 1234" },
      { entity_type: "customer", actor_name: "boss.zz", detail: "Merged SN L into SN ZZB 1234" },
    ]);
    // Put back the blank one: it's on the account again, and logged.
    const back = retired.find((r) => r.unitId === blank);
    await IMP.putBackEquipmentUnit(sql, back.id, { userId: "u-boss", name: "boss.zz" });
    assert.deepEqual((await pg.query("select id from account_equipment order by id")).rows.map((r) => r.id), [keep, blank]);
    const last = (await pg.query("select actor_name, detail from activity order by id desc limit 1")).rows[0];
    assert.deepEqual(last, { actor_name: "boss.zz", detail: "Put back a unit with no serial (it was merged into SN ZZB 1234; what the merge moved stays on that unit)" });
  } finally {
    await pg.close();
  }
});

test("the Equipment tab: Merge only for a true duplicate and only for an Admin, in the app dialog; Put back asks first", () => {
  const ui = src("src/components/desk/account-history.tsx");
  assert.match(ui, /canMergeUnits\(/, "the same rule as the server");
  assert.match(ui, /canRemove && canMergeUnits\(/, "hidden from non-Admins, like Remove");
  assert.doesNotMatch(ui, /sameUnitModel\(other, row\)/);
  assert.match(ui, /Merge duplicate/);
  assert.doesNotMatch(ui, /Merge into \{/);
  assert.doesNotMatch(ui, /window\.confirm\(`Keep SN/);
  assert.match(ui, /data-testid="merge-confirm"/);
  assert.match(ui, /data-testid="put-back-confirm"/);
  assert.match(ui, /stay on the kept unit/);
  // The server function goes through the guarded merge.
  const server = src("src/lib/ops/account-equip-import.ts");
  assert.match(server, /export const mergeAccountEquipment[\s\S]*?mergeDuplicateUnits\(/);
});

test("the Merge dialog's counts: installs on its visits, PMs that have it, tickets on the account naming its serial", async () => {
  const { pg, sql, unit } = await fresh();
  try {
    const a = await unit("ZZB1234");
    const b = await unit(null);
    const inst = (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [SITE, MODEL])).rows[0].id;
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [inst, a]);
    const pm = (await pg.query("insert into pm_jobs (customer, equipment) values ($1, $2) returning id", [SITE, MODEL])).rows[0].id;
    await pg.query("insert into pm_runbook_unit_links (pm_job_id, piece_key, account_equipment_id) values ($1, 'piece:x#1', $2)", [pm, a]);
    await pg.query("insert into service_jobs (kind, call_id, customer, equipment) values ('service', 'SC-ZZ1', $1, 'Brewer SN zzb 1234'), ('service', 'SC-ZZ2', $2, 'ZZB1234')", [SITE, OTHER]);
    assert.deepEqual(await IMP.unitLinkCounts(sql, [a, b]), { [a]: { tickets: 1, installs: 1, pms: 1 }, [b]: { tickets: 0, installs: 0, pms: 0 } });
  } finally {
    await pg.close();
  }
});
