import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { findWoEverywhere, withWoMatches, woBoardName, woMatchesSearch, woSearchKey } = await import("../src/lib/ops/wo-search.ts");
const { corrigoReviewReason } = await import("../src/lib/ops/corrigo.ts");

test("a WO number in the search box gives its match key however it is typed", () => {
  for (const q of ["WO-0855", "wo-0855", "WO0855", "WO 855", "ST# 855", "#0855", "0855", "855", " 0855 "]) {
    assert.equal(woSearchKey(q), "855", q);
  }
  for (const q of ["Baldi", "IAH", "85", "", "SC-202610-001", "WO-0855 Baldi"]) {
    assert.equal(woSearchKey(q), null, q);
  }
});

test("WO-0855, WO-855 and WO855 are the same ticket; WO-8550 is not", () => {
  assert.equal(woMatchesSearch("WO-0855", "855"), true);
  assert.equal(woMatchesSearch("WO-855", "855"), true);
  assert.equal(woMatchesSearch("WO855", "855"), true);
  assert.equal(woMatchesSearch("WO-8550", "855"), false);
  assert.equal(woMatchesSearch(null, "855"), false);
});

test("a board search for a WO finds the ticket outside the current view; plain text keeps the view", () => {
  const all = [
    { id: 1, wo: "WO-0855", status: "Completed" },
    { id: 2, wo: "WO-0900", status: "Open" },
  ];
  const activeView = all.filter((r) => r.status !== "Completed");
  assert.deepEqual(withWoMatches(activeView, all, "0855").map((r) => r.id), [1, 2]);
  assert.deepEqual(withWoMatches(activeView, all, "WO-855").map((r) => r.id), [1, 2]);
  assert.deepEqual(withWoMatches(activeView, all, "cafe").map((r) => r.id), [2]);
});

test("findWoEverywhere returns the WO on every board in any status, with where it is", async () => {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, status, done) values ('service', 'SC-1', 'A', 'WO-0856', 'Completed', true)");
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-2', 'A', 'WO-8560', 'Open')");
  await pg.query("insert into pm_jobs (customer, status, wo) values ('B', 'Pending Scheduling', 'WO-856')");
  await pg.query("insert into installs (customer, equip_status, wo) values ('C', 'Not Ready', 'WO-0856')");
  await pg.query("insert into installs (customer, equip_status, complete, wo) values ('D', 'Installed', true, '0856')");
  await pg.query("insert into installs (customer, equip_status, wo, archived) values ('E', 'Not Ready', 'WO-0856', true)");
  const hits = await findWoEverywhere(sql, woSearchKey("WO-0856"));
  assert.deepEqual(
    hits.map((h) => `${h.entityType}:${h.customer}:${h.status}`),
    ["service:A:Completed", "pm:B:Pending Scheduling", "install:C:Not Ready", "install:D:Installed"],
  );
});

test("a ticket the Corrigo import created is listed for review even when it is already closed", () => {
  assert.equal(corrigoReviewReason({ created: true, closed: true, wrapRepeat: false }), "created");
  assert.equal(corrigoReviewReason({ created: false, closed: true, wrapRepeat: false }), null);
  assert.equal(corrigoReviewReason({ created: false, closed: false, wrapRepeat: false }), "open");
  assert.equal(corrigoReviewReason({ created: true, closed: false, wrapRepeat: false }), "open");
  assert.equal(corrigoReviewReason({ created: false, closed: true, wrapRepeat: true }), "wrap");
});

test("a closed install the import created is on For Review, marked new, on the Installs board", async () => {
  const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
  const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  const { records } = parseCorrigoMatrix([
    ["ST#", "Operational Status", "Customer Name", "P.O. #", "Date/Time Completed"],
    ["0855", "Completed", "Cafe", "Install", "10/19/2026"],
  ]);
  const preview = await previewCorrigoRecords(sql, records);
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal(res.created, 1);
  assert.deepEqual(
    res.review.map((r) => ({ wo: r.wo, entityType: r.entityType, status: r.status, reason: r.reason, created: r.created })),
    [{ wo: "WO-0855", entityType: "install", status: "Installed", reason: "created", created: true }],
  );
  assert.equal(woBoardName("install"), "Installs");
});
