import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { addMachinePartSql, machinePartQty, pinLineSql, removeMachinePartSql } = await import("../src/lib/ops/pm-runbook-api.ts");
const { partHistory } = await import("../src/lib/ops/parts-api.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
  await pg.exec(readFileSync(new URL(name, dir), "utf8"));
}
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };

let n = 0;
async function pm(status = "Open", equipment = "Linea PB") {
  n += 1;
  const row = await pg.query("insert into pm_jobs (customer, equipment, status) values ($1, $2, $3) returning id", [`Cafe ${n}`, equipment, status]);
  return Number(row.rows[0].id);
}
async function item(fields = {}) {
  n += 1;
  const row = await pg.query(
    `insert into billing_items (sku, item, description, rate, kind, active, hidden_at)
     values ($1, $2, $3, 12, $4, $5, $6) returning id`,
    [
      fields.sku ?? `SKU${n}`,
      fields.item ?? `PARTS : SKU${n}`,
      fields.description ?? "Gasket",
      fields.kind ?? "part",
      fields.active ?? true,
      fields.hidden ? new Date().toISOString() : null,
    ],
  );
  return { id: Number(row.rows[0].id), item: fields.item ?? `PARTS : SKU${n}`, sku: fields.sku ?? `SKU${n}` };
}
async function add(pmId, itemId, piece = "piece:linea pb#1", extra = {}) {
  return sql.query(addMachinePartSql(), [
    pmId,
    itemId,
    piece,
    extra.accountId ?? null,
    extra.serialKey ?? null,
    extra.label ?? "Linea PB",
    extra.qty ?? 2,
    extra.billable ?? true,
    extra.note ?? null,
    "Oliver",
    extra.serial ?? "123",
  ]);
}

test("a quantity that rounds to zero is refused before the insert", () => {
  assert.throws(() => machinePartQty("0.001"), /Quantity must be more than 0\./);
  assert.equal(machinePartQty("2"), 2);
  assert.throws(() => machinePartQty(""), /Quantity must be more than zero\./);
  assert.throws(() => machinePartQty(0), /Quantity must be more than zero\./);
});

test("adding a part writes one row and one activity row", async () => {
  const pmId = await pm("Completed");
  const part = await item({ sku: "EVER104120", item: "PARTS : EVER104120", description: "Burr set" });
  const saved = await add(pmId, part.id, "piece:linea pb#1", { billable: true, qty: 2 });
  assert.equal(saved.length, 1);
  const rows = await pg.query("select qty, billable, item from machine_parts where pm_job_id = $1", [pmId]);
  assert.equal(rows.rows.length, 1);
  assert.equal(Number(rows.rows[0].qty), 2);
  assert.equal(rows.rows[0].billable, true);
  const act = await pg.query("select action, detail from activity where entity_type = 'pm' and entity_id = $1 and action = 'part added'", [pmId]);
  assert.equal(act.rows.length, 1);
  assert.match(act.rows[0].detail, /2 x PARTS : EVER104120 on Linea PB SN 123/);
});

test("a part that is not billable is stored too", async () => {
  const pmId = await pm();
  const part = await item();
  const saved = await add(pmId, part.id, "piece:swift#1", { billable: false, qty: 1, label: "Swift", serial: null });
  assert.equal(saved.length, 1);
  const row = (await pg.query("select billable from machine_parts where id = $1", [saved[0].id])).rows[0];
  assert.equal(row.billable, false);
});

test("hidden, inactive, unknown, trip and labor items insert nothing", async () => {
  const pmId = await pm();
  const hidden = await item({ hidden: true });
  const inactive = await item({ active: false });
  const trip = (await pg.query("select id from billing_items where sku = 'TRIPCHARGE'")).rows[0];
  const labor = (await pg.query("select id from billing_items where sku = 'SERVICELABOR'")).rows[0];
  assert.equal((await add(pmId, hidden.id)).length, 0);
  assert.equal((await add(pmId, inactive.id)).length, 0);
  assert.equal((await add(pmId, 999999)).length, 0);
  assert.equal((await add(pmId, Number(trip.id))).length, 0);
  assert.equal((await add(pmId, Number(labor.id))).length, 0);
  assert.equal((await pg.query("select count(*)::int as n from machine_parts where pm_job_id = $1", [pmId])).rows[0].n, 0);
});

test("a cancelled PM, a billed stacked ticket, and a PM invoice with lines insert nothing; a completed PM does", async () => {
  const cancelled = await pm("Cancelled");
  const part = await item();
  assert.equal((await add(cancelled, part.id)).length, 0);

  const stacked = await pm("Completed");
  const ticket = await pg.query(
    "insert into service_jobs (kind, call_id, customer, status, ns_so) values ('service', $1, 'Cafe', 'Open', 'SO4401') returning id",
    [`SC-MP-${stacked}`],
  );
  await pg.query("update pm_jobs set stacked_job_id = $2 where id = $1", [stacked, Number(ticket.rows[0].id)]);
  assert.equal((await add(stacked, part.id)).length, 0);

  const invoiced = await pm("Completed");
  const inv = await pg.query("insert into invoices (entity_type, entity_id, customer) values ('pm', $1, 'Cafe') returning id", [invoiced]);
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate, kind) values ($1, 'PARTS : X', 1, 1, 'part')", [Number(inv.rows[0].id)]);
  assert.equal((await add(invoiced, part.id)).length, 0);

  const done = await pm("Completed");
  assert.equal((await add(done, part.id)).length, 1);
});

test("the 51st part on one machine is refused", async () => {
  const pmId = await pm();
  const part = await item();
  for (let i = 0; i < 50; i++) assert.equal((await add(pmId, part.id, "piece:linea pb#1", { qty: 1 })).length, 1);
  assert.equal((await add(pmId, part.id, "piece:linea pb#1", { qty: 1 })).length, 0);
  const other = await add(pmId, part.id, "piece:swift#1", { qty: 1, label: "Swift" });
  assert.equal(other.length, 1);
});

test("remove is soft and logs once, and is refused while the part is on a ticket", async () => {
  const pmId = await pm();
  const part = await item();
  const saved = await add(pmId, part.id);
  const id = Number(saved[0].id);
  const job = await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', $1, 'Cafe') returning id", [`SC-RM-${id}`]);
  const jobId = Number(job.rows[0].id);
  await pg.query("insert into ticket_charges (job_id, item, qty, rate, kind, source_key, sort) values ($1, 'PARTS : X', 1, 1, 'part', $2, 1)", [jobId, `mp:${id}`]);
  assert.equal((await sql.query(removeMachinePartSql(), [pmId, id, "Oliver"])).length, 0);
  assert.equal((await pg.query("select removed_at from machine_parts where id = $1", [id])).rows[0].removed_at, null);
  await pg.query("delete from ticket_charges where job_id = $1", [jobId]);
  assert.equal((await sql.query(removeMachinePartSql(), [pmId, id, "Oliver"])).length, 1);
  assert.ok((await pg.query("select removed_at from machine_parts where id = $1", [id])).rows[0].removed_at);
  const act = await pg.query("select count(*)::int as n from activity where entity_type = 'pm' and entity_id = $1 and action = 'part removed'", [pmId]);
  assert.equal(act.rows[0].n, 1);
  assert.equal((await sql.query(removeMachinePartSql(), [pmId, id, "Oliver"])).length, 0);
  assert.equal((await pg.query("select count(*)::int as n from activity where entity_type = 'pm' and entity_id = $1 and action = 'part removed'", [pmId])).rows[0].n, 1);
});

test("pin stamps only that line's parts with the account unit and serial key", async () => {
  const pmId = await pm("Open", "Linea PB + Swift");
  const part = await item();
  const linea = await add(pmId, part.id, "piece:linea pb#1");
  const swift = await add(pmId, part.id, "piece:swift#1", { label: "Swift", serial: null });
  const equip = await pg.query(
    "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cafe', 'Linea PB', 'Linea PB', 'SN9', 'sn9') returning id",
  );
  const accountId = Number(equip.rows[0].id);
  const pinned = await sql.query(pinLineSql(), [pmId, "piece:linea pb#1", accountId]);
  assert.equal(Number(pinned[0].account_equipment_id), accountId);
  const rows = await pg.query("select id, piece_key, account_equipment_id, serial_key from machine_parts where pm_job_id = $1 order by id", [pmId]);
  const byId = Object.fromEntries(rows.rows.map((r) => [Number(r.id), r]));
  assert.equal(Number(byId[Number(linea[0].id)].account_equipment_id), accountId);
  assert.equal(byId[Number(linea[0].id)].serial_key, "sn9");
  assert.equal(byId[Number(swift[0].id)].account_equipment_id, null);
  const link = await pg.query("select account_equipment_id from pm_runbook_unit_links where pm_job_id = $1 and piece_key = 'piece:linea pb#1'", [pmId]);
  assert.equal(Number(link.rows[0].account_equipment_id), accountId);
});

test("removePart refuses a Parts-list item that is logged on a machine", async () => {
  const pmId = await pm();
  const part = await item({ sku: "EVER9", item: "PARTS : EVER9" });
  await add(pmId, part.id);
  const places = await partHistory(sql, part);
  assert.ok(places.some((p) => p === `PM #${pmId} (machine part)`));
});
