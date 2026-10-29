// Chuy 10/21: several install rows of one import for one account with no open install become one install — the
// first row opens it, the later rows go on it as more WOs. Exactly different equipment, another account, or a
// Walk-In still opens its own.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { chunkByBytes, mergeCorrigoPreviews, newInstallChoice, parseCorrigoMatrix, settleInstallRows } = await import("../src/lib/ops/corrigo.ts");
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

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Eversys e''4m'), ('Bunn ITCB'), ('Bunn TB3')");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return { pg, sql: { query } };
}

const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment", "Date/Time Completed"], ...rows]).records;
const installs = (sql) => sql.query("select id, customer, wo, equip_status, complete, to_char(completed_at, 'YYYY-MM-DD') as d from installs order by id");
const wosOf = async (sql, id) => (await sql.query("select wo, status from install_work_orders where install_id = $1 order by id", [id])).map((r) => `${r.wo}:${r.status}`);
const lean = (r) => ({ ...r, installOptions: null, installState: null });

test("Starbucks WO-0901 + WO-0902, no open install: one install with both WOs; the preview is what apply writes, row by row and chunk by chunk", async () => {
  for (const mode of ["one call", "one row per chunk"]) {
    const { pg, sql } = await fresh();
    try {
      const records = file([
        ["0901", "Completed", "Starbucks", "Install", "", "10/19/2026"],
        ["0902", "Work Started", "STARBUCKS, Inc.", "Install", "", ""],
      ]);
      const parts = [];
      for (const chunk of chunkByBytes(records, 1_500_000, mode === "one call" ? 300 : 1)) parts.push(await previewCorrigoRecords(sql, chunk));
      const rows = settleInstallRows(mergeCorrigoPreviews(parts, { skipped: 0, columns: {}, missing: [] }).rows);
      assert.deepEqual(
        rows.map((r) => [r.wo, r.action, r.installNewFrom ?? null, r.installChoice, r.newStatus, r.customer]),
        [
          ["WO-0901", "create", null, null, "Not Ready", "Starbucks"],
          ["WO-0902", "update", "901", newInstallChoice("901"), "Ready", "Starbucks"],
        ],
        mode,
      );
      assert.equal(rows[0].statusNote, "1 of 2 work orders completed → keeps Not Ready");
      assert.deepEqual(rows[1].installOptions.map((o) => o.label), ["Attach to the new install from WO-0901", "Create new install"]);
      if (mode === "one call") await applyCorrigoRows(sql, rows.map(lean), "Chuy");
      else for (const r of rows) await applyCorrigoRows(sql, [lean(r)], "Chuy");
      const all = await installs(sql);
      assert.equal(all.length, 1, mode);
      assert.deepEqual([all[0].customer, all[0].wo, all[0].equip_status, all[0].complete], ["Starbucks", "WO-0901", "Ready", false]);
      assert.deepEqual(await wosOf(sql, all[0].id), ["WO-0901:Completed", "WO-0902:Work Started"]);
    } finally {
      await pg.close();
    }
  }
});

test("a combined project is Installed only when all its WOs are completed, with its last WO's date", async () => {
  const { pg, sql } = await fresh();
  try {
    const rows = (await previewCorrigoRecords(sql, file([
      ["0901", "Completed", "Starbucks", "Install", "", "10/20/2026"],
      ["0902", "Completed", "Starbucks", "Install", "", "10/19/2026"],
    ]))).rows;
    assert.deepEqual(rows.map((r) => [r.action, r.newStatus]), [["create", "Installed"], ["update", "Installed"]]);
    for (const r of rows) await applyCorrigoRows(sql, [lean(r)], "Chuy");
    const all = await installs(sql);
    assert.deepEqual(all.map((i) => [i.equip_status, i.complete, i.d]), [["Installed", true, "2026-10-20"]]);
  } finally {
    await pg.close();
  }
});

test("exactly different equipment, two accounts, or a Walk-In: each opens its own install", async () => {
  const { pg, sql } = await fresh();
  try {
    const rows = (await previewCorrigoRecords(sql, file([
      ["0901", "Work Started", "Starbucks", "Install", "Bunn ITCB", ""],
      ["0902", "Work Started", "Starbucks", "Install", "Eversys e'4m", ""],
      ["0903", "Work Started", "Starbucks", "Install", "", ""],
      ["0911", "Work Started", "Starbucks Reserve", "Install", "", ""],
      ["0921", "Work Started", "Walk-In", "Install", "", ""],
      ["0922", "Work Started", "Walk-In", "Install", "", ""],
    ]))).rows;
    assert.deepEqual(
      rows.map((r) => [r.wo, r.action, r.installChoice]),
      [
        ["WO-0901", "create", null],
        // Another machine exactly: its own install, but the first row's is still choosable.
        ["WO-0902", "create", null],
        // Names nothing: the first new install.
        ["WO-0903", "update", newInstallChoice("901")],
        ["WO-0911", "create", null],
        ["WO-0921", "create", null],
        ["WO-0922", "create", null],
      ],
    );
    assert.deepEqual(rows[1].installOptions.map((o) => o.label), ["Attach to the new install from WO-0901", "Create new install"]);
    assert.equal(rows[3].installOptions, null);
    const res = await applyCorrigoRows(sql, rows.map(lean), "Chuy");
    // Walk-In is never an account (10/28): those two rows aren't written; the preview has them for review.
    assert.deepEqual([res.updated, res.created], [1, 3]);
    assert.deepEqual(res.refused.map((r) => r.wo), ["WO-0921", "WO-0922"]);
    assert.ok(rows.filter((r) => r.fileWalkIn).every((r) => r.needsReview));
    const first = (await installs(sql)).find((i) => i.wo === "WO-0901");
    assert.deepEqual(await wosOf(sql, first.id), ["WO-0901:Work Started", "WO-0903:Work Started"]);
  } finally {
    await pg.close();
  }
});

test("Create new on the first row's follower, or the first row going elsewhere, hands the new install on", async () => {
  const { pg, sql } = await fresh();
  try {
    // A similar name is listed (never preselected): the first row can be sent there instead of opening an install.
    const reserve = (await sql.query("insert into installs (customer, equip_status) values ('Starbucks Reserve', 'Not Ready') returning id"))[0].id;
    const preview = await previewCorrigoRecords(sql, file([
      ["0901", "Work Started", "Starbucks", "Install", "", ""],
      ["0902", "Work Started", "Starbucks", "Install", "", ""],
      ["0903", "Work Started", "Starbucks", "Install", "", ""],
    ]));
    assert.deepEqual(preview.rows.map((r) => [r.action, r.installChoice]), [["create", null], ["update", newInstallChoice("901")], ["update", newInstallChoice("901")]]);
    // The second row opens its own: the third still follows the first.
    const own = settleInstallRows(preview.rows, (r) => (r.wo === "WO-0902" ? null : undefined));
    assert.deepEqual(own.map((r) => [r.action, r.installChoice]), [["create", null], ["create", null], ["update", newInstallChoice("901")]]);
    // The first row goes on the similar-name install: the second opens the new one, the third follows it.
    const moved = settleInstallRows(preview.rows, (r) => (r.wo === "WO-0901" ? reserve : undefined));
    assert.deepEqual(moved.map((r) => [r.action, r.jobId, r.installChoice]), [
      ["update", reserve, reserve],
      ["create", null, null],
      ["update", null, newInstallChoice("902")],
    ]);
    // An unchecked first row hands it on too.
    const skipped = settleInstallRows(preview.rows, undefined, (r) => r.wo !== "WO-0901");
    assert.deepEqual(skipped.slice(1).map((r) => [r.action, r.installChoice]), [["create", null], ["update", newInstallChoice("902")]]);
    await applyCorrigoRows(sql, moved.map(lean), "Chuy");
    const all = await installs(sql);
    assert.equal(all.length, 2);
    assert.deepEqual(await wosOf(sql, all[1].id), ["WO-0902:Work Started", "WO-0903:Work Started"]);
  } finally {
    await pg.close();
  }
});
