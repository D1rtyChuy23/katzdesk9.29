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
    assert.deepEqual(marked, { marked: 1 });

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

test("a re-download records the latest export; the screen downloads through the record", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await ticket(sql, "WO-8101");
    await charges.markBillingExportedFor(sql, { ids: [a], who: "dana" });
    await pg.query("update service_jobs set billing_exported_at = billing_exported_at - interval '3 days' where id = $1", [a]);
    const before = (await pg.query("select billing_exported_at from service_jobs where id = $1", [a])).rows[0].billing_exported_at;
    await charges.markBillingExportedFor(sql, { ids: [a], who: "chuy" });
    const after = (await pg.query("select billing_exported_at, billing_exported_by, updated_at from service_jobs where id = $1", [a])).rows[0];
    assert.ok(after.billing_exported_at > before);
    assert.equal(after.billing_exported_by, "chuy");
    assert.deepEqual(await charges.markBillingExportedFor(sql, { ids: [], who: "chuy" }), { marked: 0 });
    const ui = readFileSync(new URL("../src/components/desk/billing-tools.tsx", import.meta.url), "utf8");
    assert.match(ui, /markBillingExported\(/, "Download records the export");
    assert.match(ui, /data-testid="billing-export-include-exported"/);
    assert.match(ui, /data-testid="billing-export-already"/);
  } finally {
    await pg.close();
  }
});
