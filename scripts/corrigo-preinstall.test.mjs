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
    "Site-visit before install",
    "Pre\u2013install walkthrough",
    "pre - install",
  ]) {
    assert.equal(C.isPreInstallVisit(words, null), true, words);
  }
  // The Problem Description decides; Work Done only when there is none (a punch list can say "pre-install").
  assert.equal(C.isPreInstallVisit(null, "Site visit to measure the counter"), true, "Work Done with no description");
  assert.equal(C.isPreInstallVisit("  ", "Pre-inspection done"), true);
  assert.equal(C.isPreInstallVisit("Install new brewer", "Followed up on the pre-install punch list"), false);
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
  C.parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Type", "Problem Description", "Date Completed", "P.O. #"], ...rows]).records;
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

test("a normal install completion with Install on its P.O. still goes on the install and installs it", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1070", "Completed", "ZZ Test Club", "Request", "ZZ Legacy L2:OTHER:Install the new ZZ Legacy and train staff", "11/19/2026", "Install SO0001"]]));
    const row = one(preview, "WO-1070");
    assert.deepEqual([row.board, row.jobId, row.byAccount, row.newStatus, row.preInstall ?? null, !!row.holdBack], ["install", id, true, "Installed", null, false]);
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

test("a visit whose WO is already on an install becomes its own Field Service ticket and leaves the install", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    await query("insert into install_work_orders (install_id, wo, match_key, status, source) values ($1, 'WO-1074', '1074', 'Open', 'corrigo'), ($1, 'WO-1080', '1080', 'Open', 'corrigo')", [id]);
    await query("update installs set wo = 'WO-1074' where id = $1", [id]);
    const preview = await previewCorrigoRecords(sql, file([["1074", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    const row = one(preview, "WO-1074");
    assert.deepEqual([row.board, row.action, row.jobId, row.visitInstallId, row.callTypeValue], ["service", "create", null, id, "Field Service"]);
    assert.deepEqual(row.visitFromInstall, { installId: id, matchKey: "1074" });
    assert.equal(row.preInstall.note, `moves WO-1074 off install #${id}, linked to it`);
    assert.deepEqual([row.preInstall.asInstall.board, row.preInstall.asInstall.jobId], ["install", id]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    const t = (await query("select kind, status, call_type, visit_install_id from service_jobs where wo = 'WO-1074'"))[0];
    assert.deepEqual([t.kind, t.status, t.call_type, t.visit_install_id], ["service", "Completed", "Field Service", id]);
    const after = (await query("select equip_status, complete, completed_at, wo from installs where id = $1", [id]))[0];
    assert.deepEqual([after.equip_status, after.complete, after.completed_at, after.wo], ["Ready", false, null, "WO-1080"]);
    assert.deepEqual((await query("select wo from install_work_orders where install_id = $1", [id])).map((r) => r.wo), ["WO-1080"]);
    const log = (await query("select detail from activity where entity_type = 'install' and entity_id = $1", [id])).map((r) => r.detail).join(" | ");
    assert.match(log, /WO-1074 moved to its own ticket: a pre-install visit/);
    // An install an earlier import already installed is left as it is, and the row says so.
    const done = await install("ZZ Test Club");
    await query("update installs set equip_status = 'Installed', complete = true, completed_at = '2026-11-13', wo = 'WO-1090' where id = $1", [done]);
    await query("insert into install_work_orders (install_id, wo, match_key, status, source) values ($1, 'WO-1090', '1090', 'Completed', 'corrigo')", [done]);
    const old = await previewCorrigoRecords(sql, file([["1090", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    assert.ok(one(old, "WO-1090").descriptionNotes.some((n) => n.warn && n.text === `Install #${done} is Installed already, maybe from this visit. Check it`));
    // The next import finds the ticket, not the install.
    const again = await previewCorrigoRecords(sql, file([["1074", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    assert.deepEqual([one(again, "WO-1074").board, one(again, "WO-1074").action], ["service", "update"]);
  } finally {
    await pg.close();
  }
});

test("Install on the P.O. is the first sign: an install row by its description, Type or account alone starts unticked for approval", async () => {
  const { pg, sql, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([
      ["1081", "Completed", "ZZ Test Club", "Request", "Install the new ZZ grinder", "11/19/2026", ""],
      ["1082", "Open", "ZZ Test Twin", "Install", "New brewer", "", ""],
      ["1083", "Open", "ZZ Test Twin", "Request", "New brewer", "", "Installation SO2"],
    ]));
    const byDescription = one(preview, "WO-1081");
    assert.deepEqual([byDescription.board, byDescription.jobId, byDescription.holdBack], ["install", id, true]);
    assert.ok(byDescription.descriptionNotes.some((n) => n.warn && n.text === "Goes on an install, but its P.O. doesn't say Install: left unticked. Tick it to approve"));
    assert.deepEqual([one(preview, "WO-1082").board, one(preview, "WO-1082").holdBack], ["install", true]);
    assert.deepEqual([one(preview, "WO-1083").board, !!one(preview, "WO-1083").holdBack], ["install", false]);
  } finally {
    await pg.close();
  }
});

test("a visit ticket links once the account has one open install, and words without 'install' link too", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const a = await install("ZZ Test Club");
    const b = await install("ZZ Test Club");
    await applyCorrigoRows(sql, (await previewCorrigoRecords(sql, file([["1076", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]))).rows, "boss");
    assert.equal((await query("select visit_install_id from service_jobs where wo = 'WO-1076'"))[0].visit_install_id, null);
    await query("update installs set archived = true where id = $1", [b]);
    const again = await previewCorrigoRecords(sql, file([["1076", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    assert.deepEqual([one(again, "WO-1076").action, one(again, "WO-1076").visitInstallId], ["update", a]);
    await applyCorrigoRows(sql, again.rows, "boss");
    assert.equal((await query("select visit_install_id from service_jobs where wo = 'WO-1076'"))[0].visit_install_id, a);

    const plain = await previewCorrigoRecords(sql, file([["1077", "Completed", "ZZ Test Club", "Request", "Preinstall check of power and water", "11/13/2026"]]));
    assert.deepEqual([one(plain, "WO-1077").board, one(plain, "WO-1077").visitInstallId], ["service", a]);
  } finally {
    await pg.close();
  }
});

test("an install archived between the preview and Confirm isn't linked, and the log doesn't claim it", async () => {
  const { pg, sql, query, install } = await freshDb();
  try {
    const id = await install("ZZ Test Club");
    const preview = await previewCorrigoRecords(sql, file([["1078", "Completed", "ZZ Test Club", "Request", VISIT, "11/13/2026"]]));
    await query("update installs set archived = true where id = $1", [id]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    const t = (await query("select id, visit_install_id from service_jobs where wo = 'WO-1078'"))[0];
    assert.equal(t.visit_install_id, null);
    const log = (await query("select detail from activity where entity_type = 'service' and entity_id = $1", [t.id])).map((r) => r.detail).join(" | ");
    assert.doesNotMatch(log, /pre-install visit for install/);
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
  assert.match(screen, /selected: applicable && !row\.needsReview && !row\.holdBack,/);
  assert.match(src("src/lib/ops/install-projects.ts"), /update service_jobs s set visit_install_id = g\.keep_id, updated_at = now\(\) from g where s\.visit_install_id = g\.drop_id returning s\.id/);
  assert.match(src("migrations/0127_ticket_visit_install.sql"), /alter table service_jobs add column if not exists visit_install_id int references installs \(id\)/);
});
