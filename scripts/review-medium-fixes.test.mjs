// Medium fixes from the 11/12 Fable review (Chuy): a ticket moved to another account needs a real one, the price file
// matches live parts only, Corrigo text with a time or a link reads as it is, and Put back returns a machine's PM
// parts lines and its row on an open install. Made-up accounts, parts and machines only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { openTicketFor, updateJobFor } = await import("../src/lib/ops/api.ts");
const { planPricing } = await import("../src/lib/ops/part-pricing.ts");
const C = await import("../src/lib/ops/corrigo.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");
const INS = await import("../src/lib/ops/inspection-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql, query };
}
const BY = { userId: "u-owner", name: "boss" };

test("a ticket moved to another account goes on a real one; a save that keeps its old name still works", async () => {
  const { pg, sql, query } = await fresh();
  try {
    await query("insert into directory_customers (name) values ('Test Diner - Main'), ('Test Cafe - North')");
    const { id } = await openTicketFor(sql, { kind: "service", customer: "Test Diner - Main", received: "2026-11-12" });
    await assert.rejects(() => updateJobFor(sql, { id, customer: "Nobody Has This Name" }, "u"), /Nobody Has This Name isn't on the customer list/);
    assert.equal((await query("select customer from service_jobs where id = $1", [id]))[0].customer, "Test Diner - Main");
    await updateJobFor(sql, { id, customer: "test cafe - NORTH" }, "u");
    assert.equal((await query("select customer from service_jobs where id = $1", [id]))[0].customer, "Test Cafe - North", "spelled as the list has it");
    // An older ticket under a name no account has: other edits still save.
    const old = Number((await query("insert into service_jobs (kind, call_id, customer, status, received) values ('service', 'SC-T-9', 'Old Name Gone', 'Open', '2026-11-01') returning id"))[0].id);
    await updateJobFor(sql, { id: old, customer: "Old Name Gone", issue: "Leaks at the group" }, "u");
    assert.deepEqual(
      (await query("select customer, issue from service_jobs where id = $1", [old]))[0],
      { customer: "Old Name Gone", issue: "Leaks at the group" },
    );
  } finally {
    await pg.close();
  }
});

test("the price file matches live parts only: a hidden or merged copy no longer makes the MPN shared", () => {
  const part = (id, sku, mpn, extra = {}) => ({ id, sku, item: sku, mpn, description: null, rate: 10, cost: null, listPrice: 12, hidden: false, itemClass: "Parts", active: true, mergedIntoSku: null, ...extra });
  const stored = [
    part(1, "ZZ-M100", "ZZ-M100"),
    part(2, "LMZZ-M100", "ZZ-M100", { hidden: true, mergedIntoSku: "ZZ-M100" }),
    part(3, "ZZ-H200", "ZZ-H200", { hidden: true }),
    part(4, "ZZ-A300", "ZZ-A300"),
    part(5, "ZZ-B300", "ZZ-A300"),
  ];
  const rows = [
    { line: 2, sheet: "S", mpn: "ZZ-M100", price: 15 },
    { line: 3, sheet: "S", mpn: "ZZ-H200", price: 15 },
    { line: 4, sheet: "S", mpn: "ZZ-A300", price: 15 },
  ];
  const plan = planPricing(rows, stored, "list");
  assert.deepEqual(plan.map((l) => [l.mpn, l.status, l.partId]), [
    ["ZZ-M100", "change", 1],
    ["ZZ-H200", "hidden", 3],
    ["ZZ-A300", "shared_mpn", null],
  ]);
});

test("Corrigo text with a time or a link on a line reads as it is; Corrigo's Equipment:Type:text form still splits", () => {
  assert.equal(C.descriptionLines("Call store at 10:30: brewer leaking"), "Call store at 10:30: brewer leaking");
  assert.equal(C.descriptionLines("Store hours: 9:00 to 5:00. Replace filter"), "Store hours: 9:00 to 5:00. Replace filter");
  assert.equal(C.descriptionLines("See photo: https://x.example/a: leak"), "See photo: https://x.example/a: leak");
  assert.equal(C.descriptionLines("Note: call first: brewer leaking"), "Note: call first: brewer leaking", "a space after the colon: plain text");
  assert.equal(
    C.descriptionLines("ZZ Test Brewer XL:OTHER:Replace filtration;ZZ Test Grinder Q:OTHER:descale the boil"),
    "ZZ Test Brewer XL: Replace filtration\nZZ Test Grinder Q: descale the boil",
  );
});

test("Put back returns the machine's PM parts lines and its row on the open install Remove took it off", async () => {
  const { pg, sql, query } = await fresh();
  try {
    await query("insert into directory_customers (name) values ('Test Steakhouse')");
    const open = Number((await query("insert into installs (customer, complete, equipment, serial) values ('Test Steakhouse', false, 'Test Grinder', 'TG-1') returning id"))[0].id);
    const id = Number((await query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Test Steakhouse', 'Test Grinder', 'Test Grinder', 'TG-1', 'tg-1') returning id"))[0].id);
    await INS.syncInstallUnits(sql, open);
    const pm = Number((await query("insert into pm_jobs (customer, status) values ('Test Steakhouse', 'Completed') returning id"))[0].id);
    const line = Number((await query("insert into machine_parts (pm_job_id, piece_key, account_equipment_id, machine_label, item) values ($1, 'p', $2, 'Test Grinder', 'Test burr') returning id", [pm, id]))[0].id);
    await IMP.removeEquipmentUnit(sql, id, BY);
    assert.equal((await query("select account_equipment_id from machine_parts where id = $1", [line]))[0].account_equipment_id, null);
    assert.deepEqual((await query("select equipment, serial from installs where id = $1", [open]))[0], { equipment: null, serial: null });
    const [{ id: retiredId }] = await query("select id from account_equipment_retired");
    assert.deepEqual(await IMP.putBackEquipmentUnit(sql, retiredId), { id });
    assert.equal((await query("select account_equipment_id from machine_parts where id = $1", [line]))[0].account_equipment_id, id);
    assert.deepEqual((await query("select equipment, serial from installs where id = $1", [open]))[0], { equipment: "Test Grinder", serial: "TG-1" });
    // Opening the install finds the same unit: no second grinder.
    await INS.readInspection(sql, open);
    assert.deepEqual((await query("select id from account_equipment")).map((r) => r.id), [id]);
  } finally {
    await pg.close();
  }
});

test("Put back leaves a parts line that was linked to another unit meanwhile, and a list that already has the machine", async () => {
  const { pg, sql, query } = await fresh();
  try {
    await query("insert into directory_customers (name) values ('Test Steakhouse')");
    const open = Number((await query("insert into installs (customer, complete, equipment, serial) values ('Test Steakhouse', false, 'Test Grinder', 'TG-1') returning id"))[0].id);
    const id = Number((await query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Test Steakhouse', 'Test Grinder', 'Test Grinder', 'TG-1', 'tg-1') returning id"))[0].id);
    const other = Number((await query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Test Steakhouse', 'Test Brewer', 'Test Brewer', 'TB-1', 'tb-1') returning id"))[0].id);
    await INS.syncInstallUnits(sql, open);
    const pm = Number((await query("insert into pm_jobs (customer, status) values ('Test Steakhouse', 'Completed') returning id"))[0].id);
    const line = Number((await query("insert into machine_parts (pm_job_id, piece_key, account_equipment_id, machine_label, item) values ($1, 'p', $2, 'Test Grinder', 'Test burr') returning id", [pm, id]))[0].id);
    await IMP.removeEquipmentUnit(sql, id, BY);
    await query("update machine_parts set account_equipment_id = $2 where id = $1", [line, other]);
    // Someone typed the grinder back onto the list while it was retired.
    await query("update installs set equipment = 'Test Grinder', serial = 'TG-1' where id = $1", [open]);
    const [{ id: retiredId }] = await query("select id from account_equipment_retired");
    await IMP.putBackEquipmentUnit(sql, retiredId);
    assert.equal((await query("select account_equipment_id from machine_parts where id = $1", [line]))[0].account_equipment_id, other);
    assert.deepEqual((await query("select equipment, serial from installs where id = $1", [open]))[0], { equipment: "Test Grinder", serial: "TG-1" }, "listed once");
  } finally {
    await pg.close();
  }
});
