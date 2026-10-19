import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { benchAddKitSql, benchRemoveKitSql, defaultConfig, pmAddKitSql, pmRemoveKitSql, pmTickSql, pmUnitConfigSql, removedKitCheckKeys, unitHistory, unitModelPicked } from "../src/lib/ops/pm-runbook.ts";
import { matchLmLinea } from "../src/lib/ops/runbooks/la-marzocco-match.ts";

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
    const add = (ev, name) => pg.query(pmAddKitSql(), [pm, "acct:9", "eversys-e4-xwide", ev, "Chuy", null, detail("Added", ev, name), null]);
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
    await pg.query("insert into module_runbook_checks (service_id, key) values ($1, $2), ($1, $3)", [id, "kit:EV109590", "step:hyd-kit"]);
    await pg.query(benchRemoveKitSql(), [id, "EV109590", moduleId, "Chuy", "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)", ["kit:EV109590", "step:hyd-kit"]]);
    const kept = await pg.query("select key from module_runbook_checks order by key");
    assert.deepEqual(kept.rows.map((r) => r.key), ["kit:EV109590", "step:hyd-kit"]);
    const again = await pg.query("select count(*)::int as n from activity where entity_type = 'module' and action = 'kit removed'");
    assert.equal(Number(again.rows[0].n), 1);
  } finally {
    await pg.close();
  }
});

test("a completed La Marzocco PM stores the install-date interval and leaves a saved one", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { recordCompletedRunbook } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
    const pm = (await pg.query("insert into pm_jobs (customer, style) values ('Cafe', '12 month PM') returning id")).rows[0].id;
    await pg.query(
      "insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, options) values ($1, $2, $3, $4::jsonb)",
      [pm, "acct:1", "la-marzocco-linea", JSON.stringify({ groups: "4", ctrl: "av" })],
    );
    await pg.query(
      "insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, interval_mo, updated_at) values ($1, $2, $3, $4, $5)",
      [pm, "acct:2", "la-marzocco-linea", "6", "2020-01-01T00:00:00Z"],
    );
    const unit = (key, install) => ({
      unitKey: key,
      pieceKey: `${key}-piece`,
      optionsKey: key === "acct:1" ? "SN-A" : "SN-B",
      accountId: key === "acct:1" ? 1 : 2,
      installDate: install,
      piece: "La Marzocco Linea PB 2AV",
      serial: key === "acct:1" ? "SN-A" : "SN-B",
      serialKey: key === "acct:1" ? "SN-A" : "SN-B",
      runbookId: "la-marzocco-linea",
      model: "pb",
    });
    await recordCompletedRunbook(sql, pm, "user-1", [unit("acct:1", "2026-07-18"), unit("acct:2", "2026-07-18")], "12 month PM", new Date("2026-10-18T15:00:00Z"));
    const rows = await pg.query("select unit_key, interval_mo, serial_key, options, updated_at::text as updated_at from pm_runbook_units order by unit_key");
    const byKey = Object.fromEntries(rows.rows.map((r) => [r.unit_key, r]));
    assert.equal(byKey["acct:1"].interval_mo, "3");
    assert.equal(byKey["acct:1"].serial_key, "SN-A");
    const kept = typeof byKey["acct:1"].options === "string" ? JSON.parse(byKey["acct:1"].options) : byKey["acct:1"].options;
    assert.equal(kept.groups, "4");
    assert.equal(kept.ctrl, "av");
    assert.equal(byKey["acct:2"].interval_mo, "6");
    assert.equal(byKey["acct:2"].serial_key, null);
    assert.match(byKey["acct:2"].updated_at, /^2020-01-01/);
  } finally {
    await pg.close();
  }
});

test("a completed PM records the same interval the sheets use", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
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

test("option history on one unit is not cut off by a newer unit", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { optionHistorySql } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const idA = (await pg.query("insert into unit_runbook_options (unit_key, serial_key, runbook_id) values ('sn-a', 'sn-a', 'eversys-e4-xwide') returning id")).rows[0].id;
    const idB = (await pg.query("insert into unit_runbook_options (unit_key, serial_key, runbook_id) values ('sn-b', 'sn-b', 'eversys-e4-xwide') returning id")).rows[0].id;
    await pg.query(
      `insert into activity (entity_type, entity_id, actor_name, action, detail, created_at)
       values ('unit_runbook', $1, 'Chuy', 'options changed', 'older on B', '2020-01-01')`,
      [idB],
    );
    await pg.query(
      `insert into activity (entity_type, entity_id, actor_name, action, detail, created_at)
       select 'unit_runbook', $1, 'Chuy', 'options changed', 'A ' || g, timestamptz '2026-01-01' + g * interval '1 minute'
         from generate_series(1, 100) g`,
      [idA],
    );
    const rows = await pg.query(optionHistorySql(), [[idA, idB]]);
    const forB = rows.rows.filter((r) => Number(r.entity_id) === Number(idB));
    assert.equal(forB.length, 1);
    const lines = unitHistory({ unitKey: "acct:2", pieceKey: "piece:b#1" }, [], forB.map((r) => ({ who: r.actor_name, at: r.created_at, detail: r.detail })));
    assert.equal(lines.length, 1);
    assert.match(lines[0].detail, /older on B/);
  } finally {
    await pg.close();
  }
});

const linea = parseRunbookDefinition(JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/la-marzocco-linea.json", import.meta.url), "utf8")));

function lineaUnit(install) {
  return {
    unitKey: "acct:1",
    pieceKey: "piece:la marzocco linea pb#1",
    optionsKey: "SN-A",
    accountId: 1,
    installDate: install,
    piece: "La Marzocco Linea PB",
    serial: "SN-A",
    serialKey: "SN-A",
    runbookId: "la-marzocco-linea",
    model: "pb",
  };
}

test("the first tick locks the interval the sheet showed that day", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { loadVisitConfig } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
    const pm = (await pg.query("insert into pm_jobs (customer, style, equipment) values ('Cafe', '12 month PM', 'La Marzocco Linea PB') returning id")).rows[0].id;
    const unit = lineaUnit("2026-06-10");
    const job = { id: pm, customer: "Cafe", style: "12 month PM" };
    const shown = await loadVisitConfig(sql, linea, job, unit, new Date("2026-10-19T00:00:00Z"));
    assert.equal(shown.pm, "3");
    await pg.query(pmTickSql(), [pm, unit.unitKey, "kit:PB.3.2", "Chuy", unit.serialKey, unit.runbookId, shown.pm]);
    const later = await loadVisitConfig(sql, linea, job, unit, new Date("2026-10-25T00:00:00Z"));
    assert.equal(later.pm, "3");
    const row = (await pg.query("select interval_mo, serial_key, model from pm_runbook_units where pm_job_id = $1", [pm])).rows[0];
    assert.equal(row.interval_mo, "3");
    assert.equal(row.serial_key, "SN-A");
    assert.equal(row.model, null);
  } finally {
    await pg.close();
  }
});

test("a completion uses the PM completed date, not the day the record is written", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { recordCompletedRunbook } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
    const pm = (await pg.query("insert into pm_jobs (customer, style, completed_at) values ('Cafe', '12 month PM', '2026-10-20') returning id")).rows[0].id;
    await recordCompletedRunbook(sql, pm, "user-1", [lineaUnit("2026-06-10")], "12 month PM", new Date("2026-10-27T00:00:00Z"));
    const row = (await pg.query("select interval_mo from pm_runbook_units where pm_job_id = $1", [pm])).rows[0];
    assert.equal(row.interval_mo, "3");
    const detail = (await pg.query("select detail from activity where entity_type = 'unit_runbook' and action = 'pm service'")).rows[0].detail;
    assert.match(detail, /3\/9-month PM/);
  } finally {
    await pg.close();
  }
});

test("saving only the interval does not mark a guessed model as picked", async () => {
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const pm = (await pg.query("insert into pm_jobs (customer, equipment) values ('Cafe', 'Linea 2AV') returning id")).rows[0].id;
    await pg.query(pmUnitConfigSql(), [pm, "piece:linea 2av#1", "la-marzocco-linea", null, "6", "Chuy", null]);
    const row = (await pg.query("select model, interval_mo from pm_runbook_units where pm_job_id = $1", [pm])).rows[0];
    assert.equal(row.interval_mo, "6");
    assert.equal(row.model, null);
    assert.equal(unitModelPicked(row.model, matchLmLinea("Linea 2AV")?.model), false);
    await pg.query(pmUnitConfigSql(), [pm, "piece:linea 2av#1", "la-marzocco-linea", "pb", "6", "Chuy", null]);
    const picked = (await pg.query("select model from pm_runbook_units where pm_job_id = $1", [pm])).rows[0];
    assert.equal(picked.model, "pb");
  } finally {
    await pg.close();
  }
});

test("a completed PM does not lock an interval, and an open one locks the day it is worked", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { visitLockForTick } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
    const donePiece = "La Marzocco Linea PB 2AV";
    const doneId = (await pg.query("insert into pm_jobs (customer, style, equipment, completed_at) values ('Cafe', '12 month PM', $1, '2026-01-19') returning id", [donePiece])).rows[0].id;
    const doneEquip = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, install_date) values ('Cafe', $1, $1, 'SN-D', '2025-10-19') returning id", [donePiece])).rows[0].id;
    assert.equal(await visitLockForTick(sql, doneId, `acct:${doneEquip}`), null);

    const statusPiece = "La Marzocco Linea PB 2AV";
    const statusId = (await pg.query("insert into pm_jobs (customer, style, equipment, status, completed_at) values ('Status Cafe', '12 month PM', $1, 'Completed', null) returning id", [statusPiece])).rows[0].id;
    const statusEquip = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, install_date) values ('Status Cafe', $1, $1, 'SN-S', '2025-10-19') returning id", [statusPiece])).rows[0].id;
    assert.equal(await visitLockForTick(sql, statusId, `acct:${statusEquip}`), null);

    const openPiece = "La Marzocco Linea PB";
    const openId = (await pg.query("insert into pm_jobs (customer, style, equipment) values ('Other', '12 month PM', $1) returning id", [openPiece])).rows[0].id;
    const openEquip = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, install_date) values ('Other', $1, $1, 'SN-O', '2026-06-10') returning id", [openPiece])).rows[0].id;
    const open = await visitLockForTick(sql, openId, `acct:${openEquip}`, new Date("2026-10-19T00:00:00Z"));
    assert.deepEqual(open, { runbookId: "la-marzocco-linea", interval: "3" });
  } finally {
    await pg.close();
  }
});

test("a completion does not record a guessed model as fact", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  await register("./node-resolve-hook.mjs", import.meta.url);
  const { recordCompletedRunbook } = await import("../src/lib/ops/pm-runbook-api.ts");
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
    const pm = (await pg.query("insert into pm_jobs (customer, style, equipment) values ('Cafe', '6 month PM', 'Linea 2AV') returning id")).rows[0].id;
    await pg.query("insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, interval_mo) values ($1, 'acct:1', 'la-marzocco-linea', '6')", [pm]);
    await recordCompletedRunbook(
      sql,
      pm,
      "user-1",
      [
        {
          unitKey: "acct:1",
          pieceKey: "piece:linea 2av#1",
          optionsKey: "SN-A",
          accountId: 1,
          installDate: null,
          piece: "Linea 2AV",
          serial: "SN-A",
          serialKey: "SN-A",
          runbookId: "la-marzocco-linea",
          model: null,
        },
      ],
      "6 month PM",
      new Date("2026-10-19T00:00:00Z"),
    );
    const detail = (await pg.query("select detail from activity where entity_type = 'unit_runbook' and action = 'pm service'")).rows[0].detail;
    assert.match(detail, /model not confirmed/);
    assert.doesNotMatch(detail, /Linea Classic/);
  } finally {
    await pg.close();
  }
});
