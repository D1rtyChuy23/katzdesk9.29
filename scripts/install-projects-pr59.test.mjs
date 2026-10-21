// Install projects, PR #59 final check: the first row's customer as the person set it holds the combined install, a
// Completed row after the wrap needs both dates to be an old project's, an explicit "new install from WO-…" follows
// the role, and a long project completed recently keeps its WO.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { chunkByBytes, mergeCorrigoPreviews, newInstallChoice, parseCorrigoMatrix, settleInstallRows } = await import("../src/lib/ops/corrigo.ts");
const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
const { addInstallWorkOrderFor } = await import("../src/lib/ops/install-work-orders.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Eversys e''4m'), ('Bunn ITCB'), ('Bunn TB3')");
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u-tech', 'melinda', true, false)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return { pg, sql: { query } };
}

const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "P.O. #", "Date/Time Completed"], ...rows]).records;
const installs = (sql) => sql.query("select id, customer, wo from installs order by id");
const wosOf = async (sql, id) => (await sql.query("select wo from install_work_orders where install_id = $1 order by id", [id])).map((r) => r.wo);
const wrapDesk = (sql) =>
  sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, received, done) values ('service', 'SC-1', 'X', 'WO-9998', 'Completed', '2025-06-01', true), ('service', 'SC-2', 'Y', 'WO-10002', 'Open', '2026-10-01', false)",
  );

/** What the browser sends: rows settled with the person's customer, each row's customer as the person sees it. */
function confirm(rows, names) {
  const customerOf = (r) => names[r.matchKey];
  const settled = settleInstallRows(rows, undefined, undefined, customerOf);
  return settled.map((r) => ({ ...r, installOptions: null, installState: null, customer: names[r.matchKey] ?? r.customer }));
}

test("1: the first row's customer changed in the preview names the combined install; its follower neither splits nor renames it", async () => {
  for (const [name, per] of [["Starbucks Coffee Company", 300], ["Starbucks Coffee Company", 1], ["Starbucks, Inc.", 1]]) {
    const { pg, sql } = await fresh();
    try {
      const records = file([["0901", "Work Started", "Starbucks", "Install", ""], ["0902", "Work Started", "Starbucks", "Install", ""]]);
      const parts = [];
      for (const chunk of chunkByBytes(records, 1_500_000, per)) parts.push(await previewCorrigoRecords(sql, chunk));
      const rows = confirm(settleInstallRows(mergeCorrigoPreviews(parts, { skipped: 0, columns: {}, missing: [] }).rows), { 901: name });
      assert.deepEqual(rows.map((r) => [r.action, r.installNewFrom ?? null, r.customer, r.existingCustomer]), [
        ["create", null, name, null],
        ["update", "901", name, name],
      ]);
      if (per === 300) await applyCorrigoRows(sql, rows, "Chuy");
      else for (const r of rows) await applyCorrigoRows(sql, [r], "Chuy");
      const all = await installs(sql);
      assert.deepEqual(all.map((i) => [i.customer, i.wo]), [[name, "WO-0901"]], `${name} / ${per}`);
      assert.deepEqual(await wosOf(sql, all[0].id), ["WO-0901", "WO-0902"]);
    } finally {
      await pg.close();
    }
  }
});

test("2: after the wrap a Completed row is an old closed install's only when both completed dates are known and the row's isn't later", async () => {
  const { pg, sql } = await fresh();
  try {
    await wrapDesk(sql);
    const old = (
      await sql.query(
        "insert into installs (customer, wo, equip_status, complete, received, completed_at) values ('Cafe Hotel', 'WO-0042', 'Installed', true, '2024-02-01', '2024-03-01') returning id",
      )
    )[0].id;
    await sql.query(
      "insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source) values ($1, 'WO-0042', '42', 'Completed', '2024-03-01', '2024-02-01', 'backfill')",
      [old],
    );
    for (const date of ["", "10/19/2026"]) {
      const p = await previewCorrigoRecords(sql, file([["0042", "Completed", "Cafe Hotel", "Install", date]]));
      assert.deepEqual([p.rows[0].action, p.rows[0].jobId, p.rows[0].wrapRepeat], ["create", null, true], date || "no date");
    }
    await sql.query("update installs set completed_at = null where id = $1", [old]);
    const p = await previewCorrigoRecords(sql, file([["0042", "Completed", "Cafe Hotel", "Install", "02/20/2024"]]));
    assert.deepEqual([p.rows[0].action, p.rows[0].jobId], ["create", null]);
    // Both known, the row's on or before the project's: the same (long) project.
    await sql.query("update installs set completed_at = '2024-03-01' where id = $1", [old]);
    const same = await previewCorrigoRecords(sql, file([["0042", "Completed", "Cafe Hotel", "Install", "02/20/2024"]]));
    assert.deepEqual([same.rows[0].action, same.rows[0].jobId], ["update", old]);
  } finally {
    await pg.close();
  }
});

test("3: an explicit attach to the new install from WO-0901 follows the role when WO-0901 hands it on", async () => {
  const { pg, sql } = await fresh();
  try {
    const pre = (await previewCorrigoRecords(sql, file([
      ["0901", "Work Started", "Starbucks", "Install", ""],
      ["0902", "Work Started", "Starbucks", "Install", ""],
      ["0903", "Work Started", "Starbucks", "Install", ""],
    ]))).rows;
    const settled = settleInstallRows(pre, (r) => (r.wo === "WO-0903" ? newInstallChoice("901") : undefined), (r) => r.wo !== "WO-0901");
    assert.deepEqual(settled.slice(1).map((r) => [r.action, r.installChoice, r.installNewFrom ?? null]), [
      ["create", null, null],
      ["update", newInstallChoice("902"), "902"],
    ]);
  } finally {
    await pg.close();
  }
});

test("4: after the wrap a long project completed recently keeps its WO: Add WO elsewhere is refused", async () => {
  const { pg, sql } = await fresh();
  try {
    await wrapDesk(sql);
    const old = (
      await sql.query(
        "insert into installs (customer, wo, equip_status, complete, received, completed_at) values ('Cafe India', 'WO-0042', 'Installed', true, '2025-07-01', current_date - 10) returning id",
      )
    )[0].id;
    await sql.query("update install_work_orders set received = '2025-07-01' where install_id = $1", [old]);
    const other = (await sql.query("insert into installs (customer, equip_status) values ('Cafe Juliet', 'Not Ready') returning id"))[0].id;
    await assert.rejects(() => addInstallWorkOrderFor(sql, "u-tech", { installId: other, wo: "42" }), new RegExp(`WO-0042 is on install #${old}\\.`));
    // Completed over a year ago too: a new job may take the number.
    await sql.query("update installs set completed_at = '2025-08-01' where id = $1", [old]);
    assert.ok((await addInstallWorkOrderFor(sql, "u-tech", { installId: other, wo: "42" })).workOrders.some((w) => w.wo === "WO-0042"));
  } finally {
    await pg.close();
  }
});
