import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { benchAddKitSql, benchRemoveKitSql, defaultConfig, pmAddKitSql, pmRemoveKitSql, removedKitCheckKeys } from "../src/lib/ops/pm-runbook.ts";

const def = parseRunbookDefinition(JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/eversys-e4-xwide.json", import.meta.url), "utf8")));
const twelve = { ...defaultConfig(def), model: "4s", pm: "12" };
const thirtySix = { ...defaultConfig(def), model: "4s", pm: "36" };

async function applyMigrations(pg) {
  const dir = new URL("../migrations/", import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  for (const name of names) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
}

const detail = (verb, ev, name) => `${verb} ${ev} ${name} (36-month kit)\nacct:9\npiece:eversys:1`;

test("two adds keep both kits; a remove clears the fitting step; a second remove writes nothing", async () => {
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const pm = (await pg.query("insert into pm_jobs (customer) values ('Cafe') returning id")).rows[0].id;
    const add = (ev, name) => pg.query(pmAddKitSql(), [pm, "acct:9", "eversys-e4-xwide", ev, "Chuy", null, detail("Added", ev, name)]);
    // PGlite runs one query at a time, so this is two statements, not a race. Each statement appends one kit.
    await add("EV109590", "Hydraulic add-on, adjustable Americano");
    await add("EV109586", "Hydraulic module Standard");
    const stored = await pg.query("select added_kits from pm_runbook_units where pm_job_id = $1 and unit_key = $2", [pm, "acct:9"]);
    assert.deepEqual(stored.rows[0].added_kits.slice().sort(), ["EV109586", "EV109590"]);
    const adds = await pg.query("select action from activity where entity_type = 'pm' and entity_id = $1 order by id", [pm]);
    assert.deepEqual(adds.rows.map((r) => r.action), ["kit added", "kit added"]);

    await pg.query("insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by) values ($1, $2, $3, $4), ($1, $2, $5, $4), ($1, $2, $6, $4)", [
      pm,
      "acct:9",
      "kit:EV109590",
      "Chuy",
      "kit:EV109586",
      "step:hyd-kit",
    ]);
    const removed = await pg.query(pmRemoveKitSql(), [pm, "acct:9", "EV109590", "Chuy", detail("Removed", "EV109590", "Hydraulic add-on, adjustable Americano"), ["kit:EV109590"]]);
    assert.equal(Number(removed.rows[0].changed), 1);
    const left = await pg.query("select added_kits from pm_runbook_units where pm_job_id = $1", [pm]);
    assert.deepEqual(left.rows[0].added_kits, ["EV109586"]);
    let ticks = await pg.query("select key from pm_runbook_checks order by key");
    assert.deepEqual(ticks.rows.map((r) => r.key), ["kit:EV109586", "step:hyd-kit"]);

    const clear12 = removedKitCheckKeys(def, twelve, "EV109586", true);
    assert.deepEqual(clear12, ["kit:EV109586", "step:hyd-kit"]);
    await pg.query(pmRemoveKitSql(), [pm, "acct:9", "EV109586", "Chuy", detail("Removed", "EV109586", "Hydraulic module Standard"), clear12]);
    ticks = await pg.query("select key from pm_runbook_checks order by key");
    assert.deepEqual(ticks.rows, []);

    await add("EV109586", "Hydraulic module Standard");
    await pg.query("insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by) values ($1, $2, $3, $4), ($1, $2, $5, $4)", [pm, "acct:9", "kit:EV109586", "Chuy", "step:hyd-kit"]);
    const clear36 = removedKitCheckKeys(def, thirtySix, "EV109586", false);
    assert.deepEqual(clear36, []);
    await pg.query(pmRemoveKitSql(), [pm, "acct:9", "EV109586", "Chuy", detail("Removed", "EV109586", "Hydraulic module Standard"), clear36]);
    ticks = await pg.query("select key from pm_runbook_checks order by key");
    assert.deepEqual(ticks.rows.map((r) => r.key), ["kit:EV109586", "step:hyd-kit"]);

    const again = await pg.query(pmRemoveKitSql(), [pm, "acct:9", "EV109590", "Chuy", detail("Removed", "EV109590", "Hydraulic add-on, adjustable Americano"), ["kit:EV109590", "step:hyd-kit"]]);
    assert.equal(Number(again.rows[0].changed), 0);
    const lines = await pg.query("select count(*)::int as n from activity where entity_type = 'pm' and action = 'kit removed' and detail like 'Removed EV109590%'");
    assert.equal(Number(lines.rows[0].n), 1);
    ticks = await pg.query("select key from pm_runbook_checks order by key");
    assert.deepEqual(ticks.rows.map((r) => r.key), ["kit:EV109586", "step:hyd-kit"]);
  } finally {
    await pg.close();
  }
});

test("a bench add and remove is one statement, and a second remove writes nothing", async () => {
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const moduleId = (await pg.query("insert into modules (module_id) values ('M-1') returning id")).rows[0].id;
    const made = await pg.query(
      "insert into module_runbook_services (module_id, context, runbook_id, started_by) values ($1, 'bench', 'eversys-e4-xwide', 'Chuy') returning id",
      [moduleId],
    );
    const id = made.rows[0].id;
    await pg.query(benchAddKitSql(), [id, "EV109590", moduleId, "Chuy", "Added EV109590 Hydraulic add-on, adjustable Americano (36-month kit)"]);
    await pg.query(benchAddKitSql(), [id, "EV109586", moduleId, "Chuy", "Added EV109586 Hydraulic module Standard (36-month kit)"]);
    const stored = await pg.query("select added_kits from module_runbook_services where id = $1", [id]);
    assert.deepEqual(stored.rows[0].added_kits.slice().sort(), ["EV109586", "EV109590"]);
    await pg.query("insert into module_runbook_checks (service_id, key) values ($1, $2), ($1, $3)", [id, "kit:EV109590", "step:hyd-kit"]);
    await pg.query(benchRemoveKitSql(), [id, "EV109590", moduleId, "Chuy", "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)", ["kit:EV109590", "step:hyd-kit"]]);
    const ticks = await pg.query("select key from module_runbook_checks");
    assert.equal(ticks.rows.length, 0);
    const lines = await pg.query("select count(*)::int as n from activity where entity_type = 'module' and entity_id = $1 and action = 'kit removed'", [moduleId]);
    assert.equal(Number(lines.rows[0].n), 1);
    await pg.query(benchRemoveKitSql(), [id, "EV109590", moduleId, "Chuy", "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)", ["kit:EV109590"]]);
    const again = await pg.query("select count(*)::int as n from activity where entity_type = 'module' and action = 'kit removed'");
    assert.equal(Number(again.rows[0].n), 1);
  } finally {
    await pg.close();
  }
});

test("a completed PM records the same interval the sheets use", async () => {
  process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { recordCompletedRunbook } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
    const pm = (await pg.query("insert into pm_jobs (customer, style) values ('Cafe', '6 month PM') returning id")).rows[0].id;
    await pg.query("insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by) values ($1, $2, $3, $4), ($1, $2, $5, $4)", [
      pm,
      "acct:1",
      "kit:EV109586",
      "Chuy",
      "step:hyd-kit",
    ]);
    await recordCompletedRunbook(
      sql,
      pm,
      "user-1",
      [
        {
          unitKey: "acct:1",
          pieceKey: "piece:eversys e4s x wide#1",
          optionsKey: "SN123",
          accountId: 1,
          installDate: "2023-10-10",
          piece: "Eversys Enigma e'4s X-Wide",
          serial: "SN123",
          serialKey: "SN123",
          runbookId: "eversys-e4-xwide",
          model: "4s",
        },
      ],
      "6 month PM",
      new Date("2026-10-18T15:00:00Z"),
    );
    const rows = await pg.query("select detail from activity where entity_type = 'unit_runbook' and action = 'pm service'");
    assert.equal(rows.rows.length, 1);
    const text = rows.rows[0].detail;
    assert.match(text, /36-month PM/);
    assert.match(text, /2 x EV109586/);
    assert.match(text, /Fit EV109586 on each hydraulic module\./);
    assert.doesNotMatch(text, /12-month PM/);
  } finally {
    await pg.close();
  }
});
