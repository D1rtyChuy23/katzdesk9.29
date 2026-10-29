// Install projects, final review (10/21): merge pairs twins one to one and counts a shared unit as its own twin, a sold
// warehouse unit moves, the drop's WOs keep their dates and only the drop's customer lock counts; after the wrap a
// long project is still one job and an old project's WO doesn't block Add WO; the WO # field obeys Add WO's rule.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
const corrigoImport = await import("../src/lib/ops/corrigo-import.ts");
const { applyCorrigoRows } = corrigoImport;

/**
 * These tests are about install projects, written before the import stopped adding accounts (10/28). The file's
 * customers are made accounts first, as the import used to make them, so the rules under test are unchanged.
 */
async function seedFileAccounts(sql, records) {
  for (const r of records) {
    const name = String(r.customer ?? "").trim();
    if (!name || /^walk\W*ins?$/i.test(name.replace(/\s+/g, ""))) continue;
    await sql.query(
      "insert into directory_customers (name) select $1::text where not exists (select 1 from directory_customers where lower(name) = lower($1::text))",
      [name],
    );
  }
}

async function previewCorrigoRecords(sql, records) {
  await seedFileAccounts(sql, records);
  return corrigoImport.previewCorrigoRecords(sql, records);
}
const { addInstallWorkOrderFor } = await import("../src/lib/ops/install-work-orders.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const api = await import("../src/lib/ops/api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Eversys e''4m'), ('Bunn ITCB'), ('Bunn TB3')");
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy', true, true), ('u-tech', 'melinda', true, false)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const install = async (sql, customer, { machines = null, wo = null, status = "Not Ready", complete = false } = {}) =>
  (
    await sql.query("insert into installs (customer, equipment, machines, wo, equip_status, complete) values ($1, $2, $3, $4, $5, $6) returning id", [
      customer,
      machines ? machines.join("\n") : null,
      machines ? JSON.stringify(machines.map((m) => ({ equipment: m, serial: "", powerVoltage: "" }))) : null,
      wo,
      status,
      complete,
    ])
  )[0].id;
const unitsOf = async (sql, id) =>
  (await sql.query("select a.id from install_inspection_units u join account_equipment a on a.id = u.equipment_id where u.install_id = $1 order by a.id", [id])).map((r) => r.id);
const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "P.O. #", "Date/Time Completed"], ...rows]).records;
const wrapDesk = (sql) =>
  sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, received, done) values ('service', 'SC-1', 'X', 'WO-9998', 'Completed', '2025-06-01', true), ('service', 'SC-2', 'Y', 'WO-10002', 'Open', '2026-10-01', false)",
  );

test("A: two drop twins of one keeper unit — paired one to one: the first gives the keeper's unit its check, the second moves with its own", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Delta Inc.", { machines: ["Bunn ITCB"] });
    const drop = await install(sql, "Cafe Delta", { machines: ["Bunn ITCB", "Bunn ITCB"] });
    await syncInstallUnits(sql, keep);
    await syncInstallUnits(sql, drop);
    const [k1] = await unitsOf(sql, keep);
    const [d1, d2] = await unitsOf(sql, drop);
    for (const u of [d1, d2]) await sql.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'water', 'Failed')", [drop, u]);
    const out = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.deepEqual([out.machines, out.units, out.unitsStayed], [1, 1, 1]);
    assert.deepEqual(await sql.query("select install_id, equipment_id from install_inspection_items order by equipment_id"), [
      { install_id: keep, equipment_id: k1 },
      { install_id: keep, equipment_id: d2 },
    ]);
    assert.deepEqual(await unitsOf(sql, keep), [k1, d2]);
    assert.equal((await sql.query("select archived from installs where id = $1", [drop]))[0].archived, true);
    // d1 stays linked to the archived drop; nothing was deleted.
    assert.deepEqual(await unitsOf(sql, drop), [d1]);
  } finally {
    await pg.close();
  }
});

test("B: a unit both same-named installs share is its own twin: the drop's checks and photos on it go to the keeper where it has none", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Foxtrot", { machines: ["Bunn ITCB"] });
    const drop = await install(sql, "Cafe Foxtrot", { machines: ["Bunn ITCB"] });
    await syncInstallUnits(sql, keep);
    await syncInstallUnits(sql, drop);
    const [shared] = await unitsOf(sql, drop);
    assert.deepEqual(await unitsOf(sql, keep), [shared]);
    await sql.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'water', 'Failed'), ($1, $2, 'power', 'Passed'), ($3, $2, 'power', 'Failed')", [drop, shared, keep]);
    await sql.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, $2, 'water', 'data:w')", [drop, shared]);
    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.deepEqual(await sql.query("select install_id, category, status from install_inspection_items order by install_id, category"), [
      { install_id: keep, category: "power", status: "Failed" },
      { install_id: keep, category: "water", status: "Failed" },
      { install_id: drop, category: "power", status: "Passed" },
    ]);
    assert.deepEqual(await sql.query("select install_id, equipment_id from install_inspection_photos"), [{ install_id: keep, equipment_id: shared }]);
  } finally {
    await pg.close();
  }
});

test("C, G, 8: a sold warehouse unit moves; the drop's WOs keep their dates; only the drop's customer lock counts", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Golf Inc.");
    const drop = await install(sql, "Cafe Golf");
    await sql.query(
      "insert into assets (kind, model, serial, install_id, status, site, sold_to, locked_at, locked_by) values ('equip', 'Bunn ITCB', 'S-1', $1, 'sold', 'sold', 'Cafe Golf', now(), 'System (sold)')",
      [drop],
    );
    await sql.query("update installs set wo = 'WO-0300', received = '2024-01-05' where id = $1", [drop]);
    // The keeper's own lock doesn't stop another install merging into it.
    await sql.query("update installs set customer_locked_at = now(), customer_locked_by = 'chuy' where id = $1", [keep]);
    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.deepEqual(await sql.query("select install_id, status, locked_by from assets"), [{ install_id: keep, status: "sold", locked_by: "System (sold)" }]);
    assert.deepEqual(await sql.query("select install_id, wo, to_char(received, 'YYYY-MM-DD') as received from install_work_orders"), [
      { install_id: keep, wo: "WO-0300", received: "2024-01-05" },
    ]);
    // A person's lock on a warehouse unit still waits for the owner.
    const keep2 = await install(sql, "Cafe Hill");
    const drop2 = await install(sql, "Cafe Hill");
    await sql.query("insert into assets (kind, model, serial, install_id, status, site, locked_at, locked_by) values ('equip', 'Bunn TB3', 'T-9', $1, 'assigned', 'field', now(), 'chuy')", [drop2]);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep2, dropId: drop2 }), /Locked by chuy/);
  } finally {
    await pg.close();
  }
});

test("D: after the wrap a long project (in 14 months ago) reported Completed on its own date is the same job", async () => {
  const { pg, sql } = await fresh();
  try {
    await wrapDesk(sql);
    const old = await install(sql, "Cafe Hotel", { wo: "WO-0042", status: "Installed", complete: true });
    await sql.query("update installs set received = '2025-08-01', completed_at = '2026-10-10' where id = $1", [old]);
    await sql.query("update install_work_orders set received = '2025-08-01', completed_at = '2026-10-10', status = 'Completed' where install_id = $1", [old]);
    await sql.query("insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source) select $1, 'WO-0042', '42', 'Completed', '2026-10-10', '2025-08-01', 'backfill' where not exists (select 1 from install_work_orders where install_id = $1)", [old]);
    const same = await previewCorrigoRecords(sql, file([["0042", "Completed", "Cafe Hotel", "Install", "10/10/2026"]]));
    assert.deepEqual([same.rows[0].action, same.rows[0].jobId], ["update", old]);
    const res = await applyCorrigoRows(sql, same.rows, "Chuy");
    assert.deepEqual([res.updated, res.created], [1, 0]);
    // Open again, or completed after the project was: a new job with a reused number.
    for (const row of [["0042", "Work Started", "Cafe Hotel", "Install", ""], ["0042", "Completed", "Cafe Hotel", "Install", "10/20/2026"]]) {
      const p = await previewCorrigoRecords(sql, file([row]));
      assert.deepEqual([p.rows[0].action, p.rows[0].wrapRepeat], ["create", true], row[1]);
    }
  } finally {
    await pg.close();
  }
});

test("E: after the wrap an old completed project's WO doesn't block Add WO, and the import puts the number on the new install", async () => {
  const { pg, sql } = await fresh();
  try {
    await wrapDesk(sql);
    const old = await install(sql, "Cafe India", { wo: "WO-0042", status: "Installed", complete: true });
    await sql.query("update installs set received = '2024-09-01', completed_at = '2024-10-01' where id = $1", [old]);
    await sql.query("update install_work_orders set received = '2024-09-01' where install_id = $1", [old]);
    const juliet = await install(sql, "Cafe Juliet");
    const added = await addInstallWorkOrderFor(sql, "u-tech", { installId: juliet, wo: "42" });
    assert.ok(added.workOrders.some((w) => w.wo === "WO-0042"));
    const other = await install(sql, "Cafe Kilo");
    await sql.query("delete from install_work_orders where install_id = $1", [juliet]);
    await sql.query("update installs set wo = null where id = $1", [juliet]);
    const p = await previewCorrigoRecords(sql, file([["0042", "Work Started", "Cafe Kilo", "Install", ""]]));
    assert.deepEqual([p.rows[0].action, p.rows[0].jobId], ["update", other]);
    // An open install's WO still blocks.
    await assert.rejects(() => addInstallWorkOrderFor(sql, "u-tech", { installId: juliet, wo: "10002" }).then(() => addInstallWorkOrderFor(sql, "u-tech", { installId: other, wo: "10002" })), /WO-10002 is on install #\d+\. Merge the installs instead\./);
  } finally {
    await pg.close();
  }
});

test("F: the WO # field can't put another open install's WO on an install either", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await install(sql, "Cafe Kilo", { wo: "WO-0855" });
    const b = await install(sql, "Cafe Lima");
    await assert.rejects(() => api.updateInstallFor(sql, { id: b, wo: "855" }, { userId: "u-tech" }), new RegExp(`WO-0855 is on install #${a}\\. Merge the installs instead\\.`));
    assert.equal((await sql.query("select wo from installs where id = $1", [b]))[0].wo, null);
    await api.updateInstallFor(sql, { id: b, wo: "856" }, { userId: "u-tech" });
    assert.equal((await sql.query("select wo from installs where id = $1", [b]))[0].wo, "856");
  } finally {
    await pg.close();
  }
});
