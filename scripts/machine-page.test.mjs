// The Machine page (One Record Per Machine, phase M3): one machine's records and everything that names it, newest
// first, each line with the record it opens. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";
const { machinePageFor, MACHINE_NOT_FOUND } = await import("../src/lib/ops/machine-page.ts");
const { readAccountUnits } = await import("../src/lib/ops/account-equip-import.ts");
const { listRetiredUnits, retireUnitRecord } = await import("../src/lib/ops/account-equip-retire.ts");

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const f of files) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  return { pg, q, sql: { query: q } };
}

/** A grinder on an account, with a ticket, a PM (runbook unit and a part), an install visit, a module, a rebuild and a move. */
async function grinder(q) {
  await q("insert into directory_customers (name) values ('Zz Cafe')");
  const [{ id: cafe }] = await q("select id from directory_customers where name = 'Zz Cafe'");
  const [unit] = await q(
    "insert into account_equipment (customer, catalog_model, equipment_name, serial) values ('Zz Cafe', 'Zz Grinder', 'Zz Grinder', 'ZZSN-1') returning id, machine_id",
  );
  const [{ id: job }] = await q(
    "insert into service_jobs (kind, call_id, customer, status, received) values ('service', 'SC-ZZ1', 'Zz Cafe', 'Open', '2026-11-02') returning id",
  );
  await q("insert into ticket_units (job_id, account_equipment_id) values ($1, $2)", [job, unit.id]);
  const [{ id: pm }] = await q("insert into pm_jobs (customer, status, projected) values ('Zz Cafe', 'Scheduled', '2026-11-10') returning id");
  await q("insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, serial_key) values ($1, 'zzsn-1', 'rb', 'zzsn-1')", [pm]);
  await q(
    "insert into machine_parts (pm_job_id, piece_key, account_equipment_id, serial_key, machine_label, item, qty, added_by) values ($1, 'p1', $2, 'zzsn-1', 'Zz Grinder', 'Burr set', 2, 'liz')",
    [pm, unit.id],
  );
  const [{ id: install }] = await q("insert into installs (customer, equipment, install_date) values ('Zz Cafe', 'G', '2026-10-20') returning id");
  await q("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [install, unit.id]);
  const [{ id: mod }] = await q("insert into modules (module_id, assigned_unit_id) values ('ZZM-1', $1) returning id", [unit.id]);
  await q("insert into module_stops (module_id, kind, customer, unit_id, by_name) values ($1, 'assigned', 'Zz Cafe', $2, 'tess')", [mod, unit.id]);
  const [{ id: rebuild }] = await q("insert into rebuilds (title, account) values ('Zz grinder refurb', 'Zz Cafe') returning id");
  await q("insert into rebuild_machines (rebuild_id, model, serial, pulled_at) values ($1, 'Zz Grinder', 'ZZSN-1', '2026-11-05 10:00-06')", [rebuild]);
  await q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, 'Zz Cafe', 'Walk-In', 'ZZSN-1', 'chuy')", [unit.id]);
  return { cafe, unit: unit.id, machine: unit.machine_id, job, pm, install, mod, rebuild };
}

test("the page lists the machine's records and every row that names it, newest first, each with what it opens", async () => {
  const { pg, q, sql } = await fresh();
  try {
    const g = await grinder(q);
    const page = await machinePageFor(sql, g.machine);
    assert.deepEqual([page.serial, page.model, page.mergedInto], ["ZZSN-1", "Zz Grinder", null]);
    assert.deepEqual(page.records, [{ where: "account", id: g.unit, customer: "Zz Cafe", customerId: g.cafe, model: "Zz Grinder", serial: "ZZSN-1" }]);
    assert.deepEqual(page.modules, [{ id: g.mod, moduleId: "ZZM-1" }]);
    const byKind = (k) => page.events.filter((e) => e.kind === k);
    assert.deepEqual(byKind("ticket").map((e) => [e.text, e.link]), [["Ticket SC-ZZ1 · Open · Zz Cafe", { kind: "service", id: g.job }]]);
    assert.deepEqual(byKind("pm").map((e) => [e.at, e.link]), [["2026-11-10", { kind: "pm", id: g.pm }]]);
    assert.deepEqual(byKind("part").map((e) => [e.text, e.who, e.link]), [["Part Burr set × 2", "liz", { kind: "pm", id: g.pm }]]);
    assert.deepEqual(byKind("install").map((e) => [e.at, e.link]), [["2026-10-20", { kind: "install", id: g.install }]]);
    assert.deepEqual(byKind("module").map((e) => [e.text, e.who]), [["Module ZZM-1 put on · Zz Cafe", "tess"]]);
    assert.deepEqual(byKind("rebuild").map((e) => [e.at, e.text, e.link]), [["2026-11-05 10:00", 'Pulled onto rebuild "Zz grinder refurb"', { kind: "rebuild", id: g.rebuild }]]);
    assert.deepEqual(byKind("move").map((e) => [e.text, e.who]), [["Move asked: Zz Cafe → Walk-In", "chuy"]]);
    assert.ok(byKind("history").some((e) => e.text.startsWith("Added")), "its equipment history: the unit was added");
    const ats = page.events.map((e) => e.at);
    assert.deepEqual(ats, [...ats].sort().reverse(), "newest first");
  } finally {
    await pg.close();
  }
});

test("a retired unit and a warehouse record of the same machine are both on its page", async () => {
  const { pg, q, sql } = await fresh();
  try {
    const g = await grinder(q);
    const [asset] = await q("insert into assets (kind, model, site, serial, status) values ('equip', 'Zz Grinder', 'Barn', 'zzsn-1', 'ready') returning id, machine_id");
    assert.equal(asset.machine_id, g.machine, "one machine per serial");
    await q("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('asset', $1, 'wh', 'moved', 'To rack B-2')", [asset.id]);
    await q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values ($1, 'assign', 'pending', 'Zz Cafe', 'wh')", [asset.id]);
    // Retire the account unit: Retire keeps a copy with its links, then the unit goes.
    await retireUnitRecord(sql, g.unit, { userId: "u-chuy", name: "chuy" });
    await q("delete from account_equipment where id = $1", [g.unit]);

    const page = await machinePageFor(sql, g.machine);
    assert.deepEqual(page.records.map((r) => r.where), ["warehouse", "retired"]);
    assert.ok(page.events.some((e) => e.kind === "warehouse" && e.text === "To rack B-2" && e.link?.kind === "asset"));
    assert.ok(page.events.some((e) => e.kind === "stock" && e.text === "Asked to send to Zz Cafe"));
    assert.ok(page.events.some((e) => (e.kind === "retired" || e.kind === "history") && /Retired/.test(e.text)), "the retire");
    // The unit's history before it was retired is still there.
    assert.ok(page.events.some((e) => e.kind === "ticket"));
    assert.ok(page.events.some((e) => e.kind === "module"));
  } finally {
    await pg.close();
  }
});

test("a machine merged into another: the other's page has its history too, and its own page says where it went", async () => {
  const { pg, q, sql } = await fresh();
  try {
    const g = await grinder(q);
    const [typo] = await q(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial) values ('Zz Cafe', 'Zz Brewer', 'Zz Brewer', 'ZZSN-TYPO') returning id, machine_id",
    );
    const [{ id: job2 }] = await q("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-ZZ2', 'Zz Cafe', 'Open') returning id");
    await q("insert into ticket_units (job_id, account_equipment_id) values ($1, $2)", [job2, typo.id]);
    // The serial was a typo of a warehouse record's.
    await q("insert into assets (kind, model, site, serial) values ('equip', 'Zz Brewer', 'Barn', 'ZZSN-2')");
    const [{ machine_id: m2 }] = await q("select machine_id from assets where serial = 'ZZSN-2'");
    await q("update account_equipment set serial = 'ZZSN-2' where id = $1", [typo.id]);

    const merged = await machinePageFor(sql, typo.machine_id);
    assert.equal(merged.mergedInto, m2);
    const kept = await machinePageFor(sql, m2);
    assert.ok(kept.events.some((e) => e.kind === "ticket" && e.text.startsWith("Ticket SC-ZZ2")));
    assert.ok(kept.records.some((r) => r.where === "account" && r.id === typo.id));
    await assert.rejects(() => machinePageFor(sql, 999999), new RegExp(MACHINE_NOT_FOUND.replace(".", "\\.")));
    assert.ok(g.machine);
  } finally {
    await pg.close();
  }
});

test("account units and retired units carry their machine, for the Machine history link", async () => {
  const { pg, q, sql } = await fresh();
  try {
    const g = await grinder(q);
    const units = await readAccountUnits(sql, "Zz Cafe");
    assert.deepEqual(units.map((u) => u.machineId), [g.machine]);
    await q(
      "insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, serial, unit, machine_id) values ($1, 'Zz Cafe', 'Zz Grinder', 'Zz Grinder', 'ZZSN-1', '{}', $2)",
      [g.unit, g.machine],
    );
    await q("delete from account_equipment where id = $1", [g.unit]);
    const retired = await listRetiredUnits(sql, "Zz Cafe");
    assert.deepEqual(retired.map((r) => r.machineId), [g.machine]);
  } finally {
    await pg.close();
  }
});
