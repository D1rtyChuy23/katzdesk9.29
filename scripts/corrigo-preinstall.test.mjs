// Pre-install visits in the Corrigo import (Grok for Chuy, approved 11/14): a completed pre-inspection or site visit
// on an account with an open install is its own Field Service ticket, linked to that install, and never closes it.
// Made-up accounts and text; the shape copies WO-1065 (a pre-installation site inspection before a planned install).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const C = await import("../src/lib/ops/corrigo.ts");
const { applyCorrigoRows, previewCorrigoRecords } = await import("../src/lib/ops/corrigo-import.ts");
const { withWorkOrders } = await import("../src/lib/ops/install-work-orders.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const VISIT = "ZZ Legacy L2:OTHER:Pre-inspection site visit before the Nov 17 ZZ Legacy install (SO0001). Checked power and water.";

test("a pre-install visit is told by its words, in the Problem Description or the Work Done", () => {
  for (const words of [
    "Pre-inspection before install",
    "pre inspection",
    "PREINSPECTION done",
    "Pre-install walk",
    "pre install check",
    "preinstall",
    "Pre-installation survey",
    "Site visit before the install",
    "site survey for new brewer install",
    "Site inspection",
  ]) {
    assert.equal(C.isPreInstallVisit(words, null), true, words);
  }
  assert.equal(C.isPreInstallVisit("Install new brewer", "Site visit to measure the counter"), true, "Work Done counts too");
  for (const words of ["Install new brewer and train staff", "Installed the grinder", "Leak at the site", "visited the site", "prep install", null]) {
    assert.equal(C.isPreInstallVisit(words, null), false, String(words));
  }
});

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await query("insert into directory_customers (name) values ('ZZ Test Club'), ('ZZ Test Twin')");
  const install = async (customer) =>
    Number((await query("insert into installs (customer, equip_status, install_date) values ($1, 'Ready', '2026-11-19') returning id", [customer]))[0].id);
  return { pg, sql, query, install };
}
const file = (rows) =>
  C.parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Type", "Problem Description", "Date Completed"], ...rows]).records;
const one = (preview, wo) => preview.rows.find((r) => r.canonicalWo === wo);

test("WO-1065's shape: a new Field Service ticket linked to the open install, which stays Ready; a second import updates it", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1065", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    const row = one(preview, "WO-1065");
    assert.deepEqual([row.board, row.action, row.jobId, row.visitInstallId, row.callTypeValue], ["service", "create", null, id, "Field Service"]);
    assert.equal(row.preInstall.label, "Pre-install visit, install status unchanged");
    assert.equal(row.preInstall.installId, id);
    // The other way, ready for the override: the row as the install ticket it would have been.
    assert.deepEqual([row.preInstall.asInstall.board, row.preInstall.asInstall.jobId, row.preInstall.asInstall.newStatus], ["install", id, "Installed"]);
    assert.ok(!row.installOptions && !row.byAccount);

    await applyCorrigoRows(sql, preview.rows, "boss");
    const ticket = (await query("select id, kind, wo, status, visit_install_id, issue, call_type from service_jobs where wo = 'WO-1065'"))[0];
    assert.deepEqual([ticket.kind, ticket.status, ticket.visit_install_id, ticket.call_type], ["service", "Completed", id, "Field Service"]);
    const after = (await query("select equip_status, complete, completed_at, wo from installs where id = $1", [id]))[0];
    assert.deepEqual([after.equip_status, after.complete, after.completed_at, after.wo], ["Ready", false, null, null]);
    assert.deepEqual(await query("select wo from install_work_orders where install_id = $1", [id]), []);

    // Matched on its WO the next time: the same ticket is updated, never a second one.
    const again = await previewCorrigoRecords(sql, file([["1065", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    assert.deepEqual([one(again, "WO-1065").action, one(again, "WO-1065").jobId, one(again, "WO-1065").board], ["update", ticket.id, "service"]);
    await applyCorrigoRows(sql, again.rows, "boss");
    assert.equal((await query("select count(*)::int as n from service_jobs where wo = 'WO-1065'"))[0].n, 1);
    assert.equal((await query("select equip_status from installs where id = $1", [id]))[0].equip_status, "Ready");

    // The install card lists the visit with its words.
    const [card] = await withWorkOrders(sql, [{ id }]);
    assert.deepEqual(
      card.visits.map((v) => [v.wo, v.jobId, v.completedAt, v.issue, v.status]),
      [["WO-1065", ticket.id, "2026-11-13", ticket.issue, "Completed"]],
    );
  } finally {
    await pg.close();
  }
});

test("a normal install completion still goes on the install and installs it", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1070", "Completed", "ZZ Test Club", "Request", "ZZ Legacy L2:OTHER:Install the new ZZ Legacy and train staff", "11/19/2026"]]));
    const row = one(preview, "WO-1070");
    assert.deepEqual([row.board, row.jobId, row.byAccount, row.newStatus, row.preInstall ?? null], ["install", id, true, "Installed", null]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    assert.equal((await query("select equip_status from installs where id = $1", [id]))[0].equip_status, "Installed");
    assert.equal((await query("select count(*)::int as n from service_jobs where wo = 'WO-1070'"))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("the override: a site visit treated as the install ticket attaches to the install, as today", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1071", "Completed", "ZZ Test Club", "Request", "ZZ Legacy L2:OTHER:Site visit to install and start up the ZZ Legacy", "11/19/2026"]]));
    const row = one(preview, "WO-1071");
    assert.equal(row.board, "service");
    // What the screen sends when the person ticks "Treat as the install ticket".
    await applyCorrigoRows(sql, [row.preInstall.asInstall], "boss");
    assert.equal((await query("select equip_status from installs where id = $1", [id]))[0].equip_status, "Installed");
    assert.deepEqual((await query("select wo from install_work_orders where install_id = $1", [id])).map((r) => r.wo), ["WO-1071"]);
    assert.equal((await query("select count(*)::int as n from service_jobs where wo = 'WO-1071'"))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("two open installs on the account: the visit is its own ticket, linked to neither, and says so", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    await install("ZZ Test Club");
    await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1072", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    const row = one(preview, "WO-1072");
    assert.deepEqual([row.board, row.action, row.visitInstallId, row.preInstall.installId], ["service", "create", null, null]);
    assert.match(row.preInstall.note, /2 open installs on this account: not linked/);
    await applyCorrigoRows(sql, preview.rows, "boss");
    assert.equal((await query("select visit_install_id from service_jobs where wo = 'WO-1072'"))[0].visit_install_id, null);
    assert.deepEqual((await query("select distinct equip_status from installs")).map((r) => r.equip_status), ["Ready"]);
  } finally {
    await pg.close();
  }
});

test("no open install: a pre-install visit is still its own ticket, not a new install", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const preview = await previewCorrigoRecords(sql, file([["1073", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    const row = one(preview, "WO-1073");
    assert.deepEqual([row.board, row.action, row.visitInstallId], ["service", "create", null]);
    assert.equal(row.preInstall.asInstall.board, "install");
    await applyCorrigoRows(sql, preview.rows, "boss");
    assert.equal((await query("select count(*)::int as n from installs"))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("a visit whose WO is already on an install stays on it, flagged to check", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    await query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-1074', '1074', 'corrigo')", [id]);
    await query("update installs set wo = 'WO-1074' where id = $1", [id]);
    const preview = await previewCorrigoRecords(sql, file([["1074", "Open", "ZZ Test Club", "Request", VISIT, ""]]));
    const row = one(preview, "WO-1074");
    assert.deepEqual([row.board, row.jobId, row.preInstall ?? null], ["install", id, null]);
    assert.ok(row.descriptionNotes.some((n) => n.warn && n.text === `Reads like a pre-install visit, but WO-1074 is already on install #${id}. Check it`));
  } finally {
    await pg.close();
  }
});

test("a service row that only mentions a site visit is left as it was", async () => {
  const { pg, sql, install } = await freshDb();
  try {
    await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1075", "Completed", "ZZ Test Club", "Request", "Site visit: leak under the brewer", "11/13/2026"]]));
    const row = one(preview, "WO-1075");
    assert.deepEqual([row.board, row.action, row.preInstall ?? null, row.visitInstallId ?? null], ["service", "create", null, null]);
  } finally {
    await pg.close();
  }
});

test("the preview tags the row, counts it, offers the override, and sends the row it settles on", () => {
  const screen = src("src/components/desk/corrigo-import.tsx");
  assert.match(screen, /\{r\.preInstall\.label\}/);
  assert.match(screen, /data-testid="corrigo-preinstall-override"/);
  assert.match(screen, /Treat as the install ticket/);
  assert.match(screen, /data-testid="corrigo-preinstall-count"/);
  assert.match(screen, /const base = useMemo\(\(\) => preview\.rows\.map\(\(r\) => \(r\.preInstall && drafts\[rowKey\(r\)\]\?\.asInstall \? r\.preInstall\.asInstall : r\)\), \[preview\.rows, drafts\]\);/);
  assert.match(screen, /const lean = \{ \.\.\.row, installOptions: null, installState: null, account: null, preInstall: null \};/);
  const card = src("src/components/desk/install-project-fields.tsx");
  assert.match(card, /data-testid="install-visits"/);
  assert.match(src("migrations/0127_ticket_visit_install.sql"), /alter table service_jobs add column if not exists visit_install_id int references installs \(id\)/);
});
