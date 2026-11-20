// Export Billing leaves out a ticket already exported (Chuy, 11/19; Data Flow Check bug 4). A ticket left the file
// only once it had a Sales Order or a NetSuite invoice, so between a download and the SO coming back the next export
// with an overlapping window listed it again. The download now records when each ticket in it was exported and by
// whom; the next build leaves those out and lists them, unless "Include already exported" is ticked. Made-up names.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/katzdesk-test-unused";

const charges = await import("../src/lib/ops/charges-api.ts");
const MIGRATIONS = new URL("../migrations/", import.meta.url);

async function fresh() {
  const pg = new PGlite();
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_customers (name) values ('Zz Test Cafe')");
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}
let n = 0;
async function ticket(sql, wo, completed = "2026-10-20") {
  n += 1;
  const id = (
    await sql.query(
      "insert into service_jobs (kind, call_id, customer, wo, status, technician, completed_at) values ('service', $1, 'Zz Test Cafe', $2, 'Completed', 'Ryan Gloria', $3) returning id",
      [`SC-EX-${n}`, wo, completed],
    )
  )[0].id;
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : TRIPCHARGE', '', 1, 150, 'part', 1)", [id]);
  return id;
}

test("a downloaded ticket is left out of the next export and listed; Include already exported puts it back", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await ticket(sql, "WO-8001", "2026-10-20");
    const b = await ticket(sql, "WO-8002", "2026-10-22");
    const first = await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-21" });
    assert.deepEqual(first.jobIds, [a]);
    // Building the file records nothing: only the download does.
    assert.equal((await pg.query("select count(*)::int as n from service_jobs where billing_exported_at is not null")).rows[0].n, 0);
    const marked = await charges.markBillingExportedFor(sql, { ids: first.jobIds, who: "chuy" });
    assert.deepEqual(marked, { marked: 1, skipped: [] });

    // The next window overlaps: WO-8001 is left out and listed, WO-8002 is in.
    const next = await charges.exportBillingFor(sql, { from: "2026-10-15", to: "2026-10-31" });
    assert.deepEqual(next.jobIds, [b]);
    assert.ok(!next.csv.includes("WO-8001"));
    assert.deepEqual(
      next.alreadyExported.map((t) => [t.id, t.wo, t.by]),
      [[a, "WO-8001", "chuy"]],
    );
    assert.match(next.alreadyExported[0].exportedAt, /^\d{4}-\d{2}-\d{2}$/);

    // Ticked: it's in the file again, and still listed as exported before.
    const again = await charges.exportBillingFor(sql, { from: "2026-10-15", to: "2026-10-31", includeExported: true });
    assert.deepEqual(again.jobIds.sort((x, y) => x - y), [a, b]);
    assert.ok(again.csv.includes("WO-8001"));
    assert.deepEqual(again.alreadyExported.map((t) => t.id), [a]);

    // A ticket's own SO still takes it out, exported or not; Include billed shows everything.
    await pg.query("update service_jobs set ns_so = 'SO7001' where id = $1", [a]);
    assert.deepEqual((await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31", includeExported: true })).jobIds, [b]);
    assert.deepEqual((await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31", includeBilled: true })).jobIds.sort((x, y) => x - y), [a, b]);
  } finally {
    await pg.close();
  }
});

test("the same person downloading again records the latest export; the screen downloads through the record", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await ticket(sql, "WO-8101");
    await charges.markBillingExportedFor(sql, { ids: [a], who: "dana" });
    await pg.query("update service_jobs set billing_exported_at = billing_exported_at - interval '3 days' where id = $1", [a]);
    const before = (await pg.query("select billing_exported_at from service_jobs where id = $1", [a])).rows[0].billing_exported_at;
    await charges.markBillingExportedFor(sql, { ids: [a], who: "dana" });
    const seen = (await pg.query("select updated_at from service_jobs where id = $1", [a])).rows[0].updated_at;
    const after = (await pg.query("select billing_exported_at, billing_exported_by, updated_at from service_jobs where id = $1", [a])).rows[0];
    assert.equal(after.updated_at.getTime(), seen.getTime(), "recording leaves updated_at alone");
    assert.ok(after.billing_exported_at > before);
    assert.equal(after.billing_exported_by, "dana");
    assert.equal(after.updated_at.getTime(), (await pg.query("select updated_at from service_jobs where id = $1", [a])).rows[0].updated_at.getTime());
    assert.deepEqual(await charges.markBillingExportedFor(sql, { ids: [], who: "chuy" }), { marked: 0, skipped: [] });
    const ui = readFileSync(new URL("../src/components/desk/billing-tools.tsx", import.meta.url), "utf8");
    assert.match(ui, /markBillingExported\(/, "Download records the export");
    assert.match(ui, /data-testid="billing-export-include-exported"/);
    assert.match(ui, /data-testid="billing-export-already"/);
  } finally {
    await pg.close();
  }
});

test("a ticket changed after its export goes in the next file again, flagged; an unchanged one stays out", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await ticket(sql, "WO-8201");
    const b = await ticket(sql, "WO-8202");
    const c = await ticket(sql, "WO-8203");
    await charges.markBillingExportedFor(sql, { ids: [a, b, c], who: "chuy" });
    // A part is added to WO-8201, WO-8202's rate changes; WO-8203 is untouched.
    await pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Parts : ZZ-GASKET', '', 1, 12, 'part', 2)", [a]);
    await pg.query("update ticket_charges set rate = 175 where job_id = $1", [b]);
    const next = await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(next.jobIds.sort((x, y) => x - y), [a, b]);
    assert.ok(next.csv.includes("ZZ-GASKET"));
    assert.deepEqual(next.alreadyExported.map((t) => [t.id, t.changed]).sort((x, y) => x[0] - y[0]), [[a, true], [b, true], [c, false]]);
    // Downloading it records the new lines, so the one after leaves them out.
    await charges.markBillingExportedFor(sql, { ids: next.jobIds, who: "dana" });
    assert.deepEqual((await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31" })).jobIds, []);
  } finally {
    await pg.close();
  }
});

test("a default download only records tickets not exported since the build; open or merged tickets never", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await ticket(sql, "WO-8301");
    const b = await ticket(sql, "WO-8302");
    const built = await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31" });
    // Someone else downloaded WO-8301 after this file was built.
    await charges.markBillingExportedFor(sql, { ids: [a], who: "dana" });
    assert.deepEqual(await charges.markBillingExportedFor(sql, { ids: built.jobIds, who: "chuy" }), { marked: 1, skipped: [{ id: a, wo: "WO-8301", by: "dana" }] });
    assert.equal((await pg.query("select billing_exported_by from service_jobs where id = $1", [a])).rows[0].billing_exported_by, "dana");
    // Ticked "Include already exported": re-recorded.
    assert.deepEqual(await charges.markBillingExportedFor(sql, { ids: [a, b], who: "chuy", again: true }), { marked: 2, skipped: [] });
    // An open ticket or a merged duplicate isn't recorded.
    const open = (await pg.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-EX-OPEN', 'Zz Test Cafe', 'WO-8303', 'Open') returning id")).rows[0].id;
    await pg.query("update service_jobs set duplicate_of = $1 where id = $2", [b, a]);
    assert.equal((await charges.markBillingExportedFor(sql, { ids: [open, a], who: "chuy", again: true })).marked, 0);
  } finally {
    await pg.close();
  }
});

test("screen: Include billed reads as in the file; a skipped ticket stops the download; ids fit an int", () => {
  const ui = readFileSync(new URL("../src/components/desk/billing-tools.tsx", import.meta.url), "utf8");
  assert.match(ui, /const resent = result\.includeBilled \|\| result\.includeExported;/);
  assert.match(ui, /again: result\.includeBilled \|\| result\.includeExported/);
  assert.match(ui, /if \(marked\.skipped\.length\)/);
  const api = readFileSync(new URL("../src/lib/ops/charges-api.ts", import.meta.url), "utf8");
  assert.match(api, /z\.number\(\)\.int\(\)\.positive\(\)\.max\(2147483647\)/);
});
