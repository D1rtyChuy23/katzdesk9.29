import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { benchAddKitSql, benchRemoveKitSql, pmAddKitSql, pmRemoveKitSql } from "../src/lib/ops/pm-runbook.ts";

const schema = `
create table pm_runbook_units (
  pm_job_id int not null,
  unit_key text not null,
  runbook_id text not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  serial_key text,
  added_kits jsonb not null default '[]',
  primary key (pm_job_id, unit_key)
);
create table pm_runbook_checks (
  pm_job_id int not null,
  unit_key text not null,
  key text not null,
  done_by text,
  done_at timestamptz not null default now(),
  primary key (pm_job_id, unit_key, key)
);
create table module_runbook_services (
  id serial primary key,
  module_id int not null,
  context text not null,
  runbook_id text not null,
  added_kits jsonb not null default '[]'
);
create table module_runbook_checks (
  service_id int not null,
  key text not null,
  done_by text,
  done_at timestamptz not null default now(),
  primary key (service_id, key)
);
create table activity (
  id serial primary key,
  entity_type text not null,
  entity_id int not null,
  actor_name text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
`;

const detail = (verb, ev, name) => `${verb} ${ev} ${name} (36-month kit)\nacct:9\npiece:eversys:1`;

test("two adds keep both kits; remove deletes the tick once; a second remove writes nothing", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(schema);
    const add = (ev, name) => pg.query(pmAddKitSql(), [9, "acct:9", "eversys-e4-xwide", ev, "Chuy", null, detail("Added", ev, name)]);
    await Promise.all([add("EV109590", "Hydraulic add-on, adjustable Americano"), add("EV109586", "Hydraulic module Standard")]);
    const stored = await pg.query("select added_kits from pm_runbook_units where pm_job_id = $1 and unit_key = $2", [9, "acct:9"]);
    assert.deepEqual(stored.rows[0].added_kits.slice().sort(), ["EV109586", "EV109590"]);
    const adds = await pg.query("select action, detail from activity where entity_type = 'pm' and entity_id = $1 order by id", [9]);
    assert.equal(adds.rows.length, 2);
    assert.deepEqual(adds.rows.map((r) => r.action).sort(), ["kit added", "kit added"]);

    await pg.query("insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by) values ($1, $2, $3, $4), ($1, $2, $5, $4)", [
      9,
      "acct:9",
      "kit:EV109590",
      "Chuy",
      "kit:EV109586",
    ]);
    const removed = await pg.query(pmRemoveKitSql(), [9, "acct:9", "eversys-e4-xwide", "EV109590", "Chuy", null, detail("Removed", "EV109590", "Hydraulic add-on, adjustable Americano"), true, "kit:EV109590"]);
    assert.equal(Number(removed.rows[0].changed), 1);
    const left = await pg.query("select added_kits from pm_runbook_units where pm_job_id = $1", [9]);
    assert.deepEqual(left.rows[0].added_kits, ["EV109586"]);
    const ticks = await pg.query("select key from pm_runbook_checks order by key");
    assert.deepEqual(ticks.rows.map((r) => r.key), ["kit:EV109586"]);
    const lines = await pg.query("select action, split_part(detail, chr(10), 1) as line from activity where entity_type = 'pm' and action = 'kit removed'");
    assert.equal(lines.rows.length, 1);
    assert.equal(lines.rows[0].line, "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)");

    const base = await pg.query(pmRemoveKitSql(), [9, "acct:9", "eversys-e4-xwide", "EV109586", "Chuy", null, detail("Removed", "EV109586", "Hydraulic module Standard"), false, "kit:EV109586"]);
    assert.equal(Number(base.rows[0].changed), 1);
    const baseTicks = await pg.query("select key from pm_runbook_checks");
    assert.deepEqual(baseTicks.rows.map((r) => r.key), ["kit:EV109586"]);

    const again = await pg.query(pmRemoveKitSql(), [9, "acct:9", "eversys-e4-xwide", "EV109590", "Chuy", null, detail("Removed", "EV109590", "Hydraulic add-on, adjustable Americano"), true, "kit:EV109590"]);
    assert.equal(Number(again.rows[0].changed), 0);
    const after = await pg.query("select count(*)::int as n from activity where entity_type = 'pm' and action = 'kit removed' and detail like 'Removed EV109590%'");
    assert.equal(Number(after.rows[0].n), 1);
    const still = await pg.query("select key from pm_runbook_checks");
    assert.deepEqual(still.rows.map((r) => r.key), ["kit:EV109586"]);
  } finally {
    await pg.close();
  }
});

test("a bench add and remove is one statement, and a second remove writes nothing", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(schema);
    const made = await pg.query("insert into module_runbook_services (module_id, context, runbook_id) values (4, 'bench', 'eversys-e4-xwide') returning id");
    const id = made.rows[0].id;
    await Promise.all([
      pg.query(benchAddKitSql(), [id, "EV109590", 4, "Chuy", "Added EV109590 Hydraulic add-on, adjustable Americano (36-month kit)"]),
      pg.query(benchAddKitSql(), [id, "EV109586", 4, "Chuy", "Added EV109586 Hydraulic module Standard (36-month kit)"]),
    ]);
    const stored = await pg.query("select added_kits from module_runbook_services where id = $1", [id]);
    assert.deepEqual(stored.rows[0].added_kits.slice().sort(), ["EV109586", "EV109590"]);
    await pg.query("insert into module_runbook_checks (service_id, key) values ($1, $2)", [id, "kit:EV109590"]);
    await pg.query(benchRemoveKitSql(), [id, "EV109590", 4, "Chuy", "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)", true, "kit:EV109590"]);
    const ticks = await pg.query("select key from module_runbook_checks");
    assert.equal(ticks.rows.length, 0);
    const lines = await pg.query("select count(*)::int as n from activity where entity_type = 'module' and entity_id = 4 and action = 'kit removed'");
    assert.equal(Number(lines.rows[0].n), 1);
    await pg.query(benchRemoveKitSql(), [id, "EV109590", 4, "Chuy", "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)", true, "kit:EV109590"]);
    const again = await pg.query("select count(*)::int as n from activity where entity_type = 'module' and action = 'kit removed'");
    assert.equal(Number(again.rows[0].n), 1);
  } finally {
    await pg.close();
  }
});
