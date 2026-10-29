import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { findWoEverywhere, searchTicketText, withWoMatches, woBoardName, woMatchesSearch, woSearchKey } = await import("../src/lib/ops/wo-search.ts");
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

test("a sales rep's WO lookup leaves out tickets, TLCs and PMs on other accounts, as their lists do; installs stay", async () => {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-1', 'Mine', 'WO-0857', 'Open')");
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('tlc', 'TLC-1', 'Theirs', 'WO-0857', 'Open')");
  await pg.query("insert into pm_jobs (customer, status, wo) values ('Theirs', 'Scheduled', 'WO-0857')");
  await pg.query("insert into pm_jobs (customer, status, wo) values ('Mine', 'Scheduled', 'WO-0857')");
  await pg.query("insert into installs (customer, equip_status, wo) values ('Theirs', 'Not Ready', 'WO-0857')");
  const mine = (customer) => customer === "Mine";
  assert.deepEqual(
    (await findWoEverywhere(sql, "857", mine)).map((h) => `${h.entityType}:${h.customer}`),
    ["service:Mine", "pm:Mine", "install:Theirs"],
  );
  assert.equal((await findWoEverywhere(sql, "857", null)).length, 5);
  // Both WO lookups (the top search and the Tickets page's "is on" line) pass the rep's scope.
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  const calls = [...api.matchAll(/findWoEverywhere\(([^\n]*)/g)].map((m) => m[1]);
  assert.equal(calls.length, 2);
  for (const call of calls) assert.match(call, /repCustomerScope\(sql, context\.userId\)|, inScope\)/);
  assert.match(api, /async function repCustomerScope[\s\S]{0,200}salesRepScope\(sql, userId\)[\s\S]{0,200}accountRepFor\(marks, customer\)/);
});

test("a sales rep's top search text matches for a WO number show only their accounts' tickets, TLCs and PMs; an admin sees all", async () => {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, status, received) values ('service', 'SC-1', 'Mine', 'WO-9439', 'Completed', '2026-01-01')");
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, status, received) values ('tlc', 'TF-1', 'Mine', 'WO-9439', 'Open', '2026-01-02')");
  // Ten newer matches on another account: the rep's own two still show, not cut off by the newest 8.
  for (let n = 0; n < 10; n++) {
    await pg.query(`insert into service_jobs (kind, call_id, customer, wo, status, received) values ('${n % 2 ? "tlc" : "service"}', 'SC-T${n}', 'Theirs', 'WO-9439', 'Completed', '2026-02-${10 + n}')`);
  }
  await pg.query("insert into pm_jobs (customer, status, wo) values ('Theirs', 'Scheduled', 'WO-9439')");
  await pg.query("insert into pm_jobs (customer, status, wo) values ('Mine', 'Scheduled', 'WO-9439')");
  const mine = (customer) => customer === "Mine";
  const rep = await searchTicketText(sql, "%WO-9439%", mine);
  assert.deepEqual(rep.jobs.map((j) => `${j.kind}:${j.customer}`), ["tlc:Mine", "service:Mine"]);
  assert.deepEqual(rep.pms.map((p) => p.customer), ["Mine"]);
  const admin = await searchTicketText(sql, "%WO-9439%", null);
  assert.equal(admin.jobs.length, 8);
  assert.ok(admin.jobs.every((j) => j.customer === "Theirs"));
  assert.deepEqual(admin.pms.map((p) => p.customer).sort(), ["Mine", "Theirs"]);
  // The top search works out the rep's scope once and gives it to the WO block and these text matches.
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  const search = api.slice(api.indexOf("export const searchAll"), api.indexOf("export const findWoTickets"));
  assert.match(search, /const inScope = await repCustomerScope\(sql, context\.userId\);/);
  assert.match(search, /findWoEverywhere\(sql, woKey, inScope\)/);
  assert.match(search, /searchTicketText\(sql, like, inScope\)/);
  assert.doesNotMatch(search, /from (service_jobs|pm_jobs)/);
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
  // The import only writes to an account that exists (10/28).
  await sql.query("insert into directory_customers (name) values ('Cafe')");
  const preview = await previewCorrigoRecords(sql, records);
  const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
  assert.equal(res.created, 1);
  assert.deepEqual(
    res.review.map((r) => ({ wo: r.wo, entityType: r.entityType, status: r.status, reason: r.reason, created: r.created })),
    [{ wo: "WO-0855", entityType: "install", status: "Installed", reason: "created", created: true }],
  );
  assert.equal(woBoardName("install"), "Installs");
});
