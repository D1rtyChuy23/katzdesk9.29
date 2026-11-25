// One Record Per Machine, phase M2 ("One Record Per Machine Plan", Chuy approved 11/24): ticket units, install machine
// lists, PM runbook units and links, PM parts, modules, move requests and rebuild machines get their machine (migrations
// 0147 and 0148), keep it up to date when their unit's machine changes, and Link Check counts them. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";
const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
const M2 = "0147_machines_m2.sql";

async function beforeM2() {
  const pg = new PGlite();
  for (const f of files.filter((f) => f < M2)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  const runM2 = async () => {
    for (const f of files.filter((f) => f >= M2)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  };
  return { pg, q, runM2, sql: { query: q } };
}
async function all() {
  const b = await beforeM2();
  await b.runM2();
  await b.q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  return b;
}

let seq = 0;
/** A small world: an account with two units (one with a serial, one without), a warehouse record, and records naming them. */
async function world(q) {
  await q("insert into directory_customers (name) values ('Zz Cafe')");
  const unit = async (serial) =>
    (await q("insert into account_equipment (customer, catalog_model, equipment_name, serial) values ('Zz Cafe', 'Zz Brewer', 'Zz Brewer', $1) returning id", [serial]))[0].id;
  const u1 = await unit("ZZSN-100");
  const u2 = await unit(null);
  const [{ id: asset }] = await q("insert into assets (kind, model, site, serial) values ('equip', 'Zz Grinder', 'Barn', 'ZZSN-200') returning id");
  const [{ id: job }] = await q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, 'Zz Cafe', 'Open') returning id", [`SC-ZZ${++seq}`]);
  const [{ id: install }] = await q("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id");
  const [{ id: pm }] = await q("insert into pm_jobs (customer) values ('Zz Cafe') returning id");
  const [{ id: rebuild }] = await q("insert into rebuilds (title, account) values ('Zz rebuild', 'Zz Cafe') returning id");
  const rows = {};
  rows.ticket = (await q("insert into ticket_units (job_id, account_equipment_id) values ($1, $2) returning *", [job, u1]))[0];
  rows.ticket2 = (await q("insert into ticket_units (job_id, account_equipment_id) values ($1, $2) returning *", [job, u2]))[0];
  rows.visit = (await q("insert into install_inspection_units (install_id, equipment_id) values ($1, $2) returning *", [install, u1]))[0];
  rows.pmLink = (await q("insert into pm_runbook_unit_links (pm_job_id, piece_key, account_equipment_id) values ($1, 'p1', $2) returning *", [pm, u1]))[0];
  rows.pmSerial = (await q("insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, serial_key) values ($1, 'zzsn-100', 'rb', 'zzsn-100') returning *", [pm]))[0];
  rows.pmAcct = (await q("insert into pm_runbook_units (pm_job_id, unit_key, runbook_id) values ($1, $2, 'rb') returning *", [pm, `acct:${u2}`]))[0];
  rows.pmPiece = (await q("insert into pm_runbook_units (pm_job_id, unit_key, runbook_id) values ($1, 'piece:grinder', 'rb') returning *", [pm]))[0];
  rows.part = (await q("insert into machine_parts (pm_job_id, piece_key, account_equipment_id, serial_key, machine_label, item) values ($1, 'p1', $2, 'zzsn-100', 'Zz Brewer', 'Gasket') returning *", [pm, u1]))[0];
  rows.partBySerial = (await q("insert into machine_parts (pm_job_id, piece_key, serial_key, machine_label, item) values ($1, 'p2', 'zzsn-200', 'Zz Grinder', 'Burr') returning *", [pm]))[0];
  rows.module = (await q("insert into modules (module_id, assigned_unit_id) values ($1, $2) returning *", [`ZZM-${++seq}`, u1]))[0];
  rows.moduleLoose = (await q("insert into modules (module_id) values ($1) returning *", [`ZZM-${++seq}`]))[0];
  rows.move = (await q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, 'Zz Cafe', 'Walk-In', 'ZZSN-100', 'zz') returning *", [u1]))[0];
  rows.rebuild = (await q("insert into rebuild_machines (rebuild_id, model, serial, asset_id) values ($1, 'Zz Grinder', 'ZZSN-200', $2) returning *", [rebuild, asset]))[0];
  rows.rebuildBySerial = (await q("insert into rebuild_machines (rebuild_id, model, serial) values ($1, 'Zz Brewer', ' zzsn-100') returning *", [rebuild]))[0];
  rows.rebuildNone = (await q("insert into rebuild_machines (rebuild_id, model) values ($1, 'Zz Mystery') returning *", [rebuild]))[0];
  const machineOf = async (table, id) => (await q(`select machine_id from ${table} where id = $1`, [id]))[0].machine_id;
  return { u1, u2, asset, job, install, pm, rebuild, rows, m1: await machineOf("account_equipment", u1), m2: await machineOf("account_equipment", u2), mAsset: await machineOf("assets", asset) };
}

/** Each row's table and how to find it again (composite keys have no id). */
const WHERE = {
  ticket: ["ticket_units", (r) => ["job_id = $1 and account_equipment_id = $2", [r.job_id, r.account_equipment_id]]],
  ticket2: ["ticket_units", (r) => ["job_id = $1 and account_equipment_id = $2", [r.job_id, r.account_equipment_id]]],
  visit: ["install_inspection_units", (r) => ["install_id = $1 and equipment_id = $2", [r.install_id, r.equipment_id]]],
  pmLink: ["pm_runbook_unit_links", (r) => ["pm_job_id = $1 and piece_key = $2", [r.pm_job_id, r.piece_key]]],
  pmSerial: ["pm_runbook_units", (r) => ["pm_job_id = $1 and unit_key = $2", [r.pm_job_id, r.unit_key]]],
  pmAcct: ["pm_runbook_units", (r) => ["pm_job_id = $1 and unit_key = $2", [r.pm_job_id, r.unit_key]]],
  pmPiece: ["pm_runbook_units", (r) => ["pm_job_id = $1 and unit_key = $2", [r.pm_job_id, r.unit_key]]],
  part: ["machine_parts", (r) => ["id = $1", [r.id]]],
  partBySerial: ["machine_parts", (r) => ["id = $1", [r.id]]],
  module: ["modules", (r) => ["id = $1", [r.id]]],
  moduleLoose: ["modules", (r) => ["id = $1", [r.id]]],
  move: ["equipment_move_requests", (r) => ["id = $1", [r.id]]],
  rebuild: ["rebuild_machines", (r) => ["id = $1", [r.id]]],
  rebuildBySerial: ["rebuild_machines", (r) => ["id = $1", [r.id]]],
  rebuildNone: ["rebuild_machines", (r) => ["id = $1", [r.id]]],
};
async function machines(q, w) {
  const out = {};
  for (const [k, [table, where]] of Object.entries(WHERE)) {
    const [text, params] = where(w.rows[k]);
    const r = (await q(`select machine_id from ${table} where ${text}`, params))[0];
    out[k] = r ? r.machine_id : "gone";
  }
  return out;
}
const expected = (w, over = {}) => ({
  ticket: w.m1,
  ticket2: w.m2,
  visit: w.m1,
  pmLink: w.m1,
  pmSerial: w.m1,
  pmAcct: w.m2,
  pmPiece: null,
  part: w.m1,
  partBySerial: w.mAsset,
  module: w.m1,
  moduleLoose: null,
  move: w.m1,
  rebuild: w.mAsset,
  rebuildBySerial: w.m1,
  rebuildNone: null,
  ...over,
});

test("0148 gives every row already there its machine, and changes nothing else", async () => {
  const { pg, q, runM2 } = await beforeM2();
  try {
    const w = await world(q);
    const snap = async () => {
      const out = {};
      for (const t of new Set(Object.values(WHERE).map(([t]) => t))) out[t] = await q(`select * from ${t} order by 1, 2`);
      out.history = await q("select count(*)::int as n from equipment_history");
      return out;
    };
    const before = await snap();
    await runM2();
    assert.deepEqual(await machines(q, w), expected(w));
    const after = await snap();
    const strip = (rows) => rows.map(({ machine_id, ...r }) => r);
    for (const t of Object.keys(before)) assert.deepEqual(t === "history" ? after[t] : strip(after[t]), before[t], t);
  } finally {
    await pg.close();
  }
});

test("new rows get their machine as they're saved", async () => {
  const { pg, q } = await all();
  try {
    const w = await world(q);
    assert.deepEqual(await machines(q, w), expected(w));
  } finally {
    await pg.close();
  }
});

test("a unit whose serial becomes another machine's takes its linked rows along", async () => {
  const { pg, q } = await all();
  try {
    const w = await world(q);
    // The second unit's serial is typed in: the grinder's serial, on the warehouse record.
    await q("update account_equipment set serial = 'ZZSN-200' where id = $1", [w.u2]);
    const m2 = (await q("select machine_id from account_equipment where id = $1", [w.u2]))[0].machine_id;
    assert.equal(m2, w.mAsset);
    assert.deepEqual(await machines(q, w), expected(w, { ticket2: w.mAsset, pmAcct: w.mAsset }));
    // And a warehouse record that changes machine takes its rebuild machines along.
    await q("update assets set serial = 'ZZSN-100' where id = $1", [w.asset]);
    const now = (await q("select machine_id from assets where id = $1", [w.asset]))[0].machine_id;
    assert.equal(now, w.m1);
    assert.equal((await machines(q, w)).rebuild, w.m1);
  } finally {
    await pg.close();
  }
});

test("a unit that's gone: its PM parts, move requests and modules keep the machine; the rows that went with it go", async () => {
  const { pg, q } = await all();
  try {
    const w = await world(q);
    await q("delete from account_equipment where id = $1", [w.u1]);
    const got = await machines(q, w);
    assert.deepEqual(
      [got.ticket, got.visit, got.pmLink, got.part, got.move, got.module],
      ["gone", "gone", "gone", w.m1, w.m1, w.m1],
    );
    assert.equal((await q("select account_equipment_id from machine_parts where id = $1", [w.rows.part.id]))[0].account_equipment_id, null);
    // A unit with no serial: nothing but the row itself says which machine it was.
    const [part] = await q("insert into machine_parts (pm_job_id, piece_key, account_equipment_id, machine_label, item) values ($1, 'p3', $2, 'Zz Brewer', 'Gasket') returning id, machine_id", [w.pm, w.u2]);
    const [move] = await q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, 'Zz Cafe', 'Walk-In', 'N/A', 'zz') returning id, machine_id", [w.u2]);
    assert.deepEqual([part.machine_id, move.machine_id], [w.m2, w.m2]);
    await q("delete from account_equipment where id = $1", [w.u2]);
    assert.equal((await q("select machine_id from machine_parts where id = $1", [part.id]))[0].machine_id, w.m2);
    await q("update equipment_move_requests set serial = 'n/a' where id = $1", [move.id]);
    assert.equal((await q("select machine_id from equipment_move_requests where id = $1", [move.id]))[0].machine_id, w.m2);
  } finally {
    await pg.close();
  }
});

test("a module taken off its unit has no machine; put on another unit, that unit's", async () => {
  const { pg, q } = await all();
  try {
    const w = await world(q);
    await q("update modules set assigned_unit_id = null where id = $1", [w.rows.module.id]);
    assert.equal((await machines(q, w)).module, null);
    await q("update modules set assigned_unit_id = $1 where id = $2", [w.u2, w.rows.module.id]);
    assert.equal((await machines(q, w)).module, w.m2);
  } finally {
    await pg.close();
  }
});

test("a rebuild machine whose warehouse record is taken off: its serial's machine, or none", async () => {
  const { pg, q } = await all();
  try {
    const w = await world(q);
    await q("update rebuild_machines set asset_id = null where id = $1", [w.rows.rebuild.id]);
    assert.equal((await machines(q, w)).rebuild, w.mAsset, "its serial is the grinder's");
    await q("update rebuild_machines set asset_id = null, serial = null where id = $1", [w.rows.rebuild.id]);
    assert.equal((await machines(q, w)).rebuild, null);
  } finally {
    await pg.close();
  }
});

test("Link Check counts each kind of row with its machine, and lists one that's off", async () => {
  const { pg, q, sql } = await all();
  try {
    const w = await world(q);
    let report = await linkCheckFor(sql, "zz-admin");
    const links = report.machines.machineLinks;
    assert.ok(links, "machine links on Link Check");
    const byTable = Object.fromEntries(links.map((l) => [l.table, l]));
    assert.deepEqual(
      Object.fromEntries(Object.entries(byTable).map(([t, l]) => [t, [l.rows, l.linked, l.missing, l.off]])),
      {
        ticket_units: [2, 2, 0, 0],
        install_inspection_units: [1, 1, 0, 0],
        pm_runbook_unit_links: [1, 1, 0, 0],
        pm_runbook_units: [3, 2, 0, 0],
        machine_parts: [2, 2, 0, 0],
        modules: [2, 1, 0, 0],
        equipment_move_requests: [1, 1, 0, 0],
        rebuild_machines: [3, 2, 0, 0],
      },
    );
    // A row put on another machine by hand, and one left without its machine.
    await q("update ticket_units set machine_id = $1 where account_equipment_id = $2", [w.mAsset, w.u1]);
    await q("update modules set machine_id = null where id = $1", [w.rows.module.id]);
    report = await linkCheckFor(sql, "zz-admin");
    const again = Object.fromEntries(report.machines.machineLinks.map((l) => [l.table, l]));
    assert.deepEqual([again.ticket_units.off, again.ticket_units.missing], [1, 0]);
    assert.deepEqual([again.modules.off, again.modules.missing], [0, 1]);
  } finally {
    await pg.close();
  }
});
