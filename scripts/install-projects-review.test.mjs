// Install projects, review fixes (10/21): preview = apply when every WO of a project completes in one file, a strict
// customer match for picking and merging (a name that only starts the same is listed, never picked), one WO on one
// install, the install keeps its own name, merge carries the install's own data, the wrap, and the backfill key.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { chunkByBytes, mergeCorrigoPreviews, parseCorrigoMatrix, settleInstallRows, woMatchKey } = await import("../src/lib/ops/corrigo.ts");
const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
const { customersLooselyMatch, customersStrictlyMatch } = await import("../src/lib/ops/clean-names.ts");
const { addInstallWorkOrderFor, loadInstallWos } = await import("../src/lib/ops/install-work-orders.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const api = await import("../src/lib/ops/api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh({ upTo } = {}) {
  const pg = new PGlite();
  for (const name of files) {
    if (upTo && name >= upTo) break;
    await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  }
  if (!upTo) {
    await pg.query("insert into directory_equipment (name) values ('Eversys e''4m'), ('Mahlkonig E65S'), ('Bunn ITCB'), ('Bunn TB3')");
    await pg.query(
      "insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy', true, true), ('u-tech', 'melinda', true, false)",
    );
  }
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const install = async (sql, customer, { machines = null, wo = null, status = "Not Ready", complete = false } = {}) =>
  (
    await sql.query(
      "insert into installs (customer, equipment, machines, wo, equip_status, complete) values ($1, $2, $3, $4, $5, $6) returning id",
      [
        customer,
        machines ? machines.join("\n") : null,
        machines ? JSON.stringify(machines.map((m) => ({ equipment: m, serial: "", powerVoltage: "" }))) : null,
        wo,
        status,
        complete,
      ],
    )
  )[0].id;
const installRow = async (sql, id) =>
  (
    await sql.query(
      "select id, customer, wo, equip_status, complete, archived, deal_id, technician, to_char(install_date, 'YYYY-MM-DD') as install_date from installs where id = $1",
      [id],
    )
  )[0];
const wosOf = async (sql, id) => (await sql.query("select wo, status from install_work_orders where install_id = $1 order by id", [id])).map((r) => `${r.wo}:${r.status}`);
const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "P.O. #", "Equipment", "Problem Description", "Date/Time Completed"], ...rows]).records;
const pairs = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("  ~  "))
    .map((l) => l.split("  ~  ").map((s) => s.trim()));

test("1: both WOs of a project Completed in one file — one install, Installed, the preview's rows are what apply writes, chunk by chunk", async () => {
  const { pg, sql } = await fresh();
  try {
    const baldi = await install(sql, "Baldi Management Group Inc.", { machines: ["Eversys e'4m"] });
    const records = file([
      ["0831", "Completed", "Baldi Management", "Install", "", "Install", "10/19/2026"],
      ["0855", "Completed", "Baldi Management", "Install", "", "Install day 2", "10/20/2026"],
    ]);
    // The browser previews a chunk at a time and settles the whole file; it applies a chunk at a time too.
    const parts = [];
    for (const chunk of chunkByBytes(records, 1_500_000, 1)) parts.push(await previewCorrigoRecords(sql, chunk));
    const rows = settleInstallRows(mergeCorrigoPreviews(parts, { skipped: 0, columns: {}, missing: [] }).rows);
    assert.deepEqual(rows.map((r) => [r.action, r.jobId, r.oldStatus, r.newStatus]), [
      ["update", baldi, "Not Ready", "Installed"],
      ["update", baldi, "Installed", "Installed"],
    ]);
    let total = { updated: 0, created: 0 };
    for (const r of rows) {
      const res = await applyCorrigoRows(sql, [{ ...r, installOptions: null, installState: null }], "Chuy");
      total = { updated: total.updated + res.updated, created: total.created + res.created };
      assert.equal((await installRow(sql, baldi)).equip_status, r.newStatus, r.wo);
    }
    assert.deepEqual(total, { updated: 2, created: 0 });
    assert.equal((await sql.query("select count(*)::int as n from installs"))[0].n, 1);
    assert.deepEqual(await wosOf(sql, baldi), ["WO-0831:Completed", "WO-0855:Completed"]);
    assert.equal((await installRow(sql, baldi)).complete, true);
  } finally {
    await pg.close();
  }
});

test("1: WOs completed out of order — the project is Installed on its last WO's date, and an earlier date never moves it back", async () => {
  const { pg, sql } = await fresh();
  try {
    const baldi = await install(sql, "Baldi Management Group Inc.", { machines: ["Eversys e'4m"], wo: "WO-0831" });
    const rows = (await previewCorrigoRecords(sql, file([
      ["0855", "Completed", "Baldi Management", "Install", "", "Install day 2", "10/20/2026"],
      ["0831", "Completed", "BALDI MANAGEMENT", "Install", "", "", "10/19/2026"],
      ["0860", "Completed", "Baldi Management Group", "Install", "", "", "10/18/2026"],
    ]))).rows;
    assert.deepEqual(rows.map((r) => [r.jobId, r.newStatus]), [[baldi, "Not Ready"], [baldi, "Installed"], [baldi, "Installed"]]);
    for (const r of rows) await applyCorrigoRows(sql, [r], "Chuy");
    assert.deepEqual(
      (await sql.query("select equip_status, to_char(completed_at, 'YYYY-MM-DD') as d from installs where id = $1", [baldi]))[0],
      { equip_status: "Installed", d: "2026-10-20" },
    );
    // All three on the one project: the third row didn't open another install.
    assert.equal((await sql.query("select count(*)::int as n from installs"))[0].n, 1);
    assert.deepEqual(await wosOf(sql, baldi), ["WO-0831:Completed", "WO-0855:Completed", "WO-0860:Completed"]);
  } finally {
    await pg.close();
  }
});

test("2: a match needs the same core words; a name that only starts the same is another business or location", () => {
  const strict = pairs("install-customer-strict-pairs.txt");
  assert.ok(strict.length >= 19);
  for (const [a, b] of strict) assert.equal(customersStrictlyMatch(a, b), true, `${a} = ${b}`);
  const key = (a, b) => [a, b].sort().join(" | ");
  const strictKeys = new Set(strict.map(([a, b]) => key(a, b)));
  const loose = pairs("install-customer-loose-pairs.txt").filter(([a, b]) => !strictKeys.has(key(a, b)));
  assert.ok(loose.length > 400);
  for (const [a, b] of loose) assert.equal(customersStrictlyMatch(a, b), false, `${a} ≠ ${b}`);
  for (const [a, b] of [
    ["Baldi Management", "Baldi Management Group Inc."],
    ["BALDI MANAGEMENT GROUP", "Baldi Management Group, Inc"],
  ]) {
    assert.equal(customersStrictlyMatch(a, b), true, `${a} = ${b}`);
  }
  for (const [a, b] of [
    ["Sweet", "Sweet Dreams"],
    ["Olive Garden", "Olive Garden #1853"],
    ["Cimbali", "Cimbali National Accounts:Olive Garden #1853"],
    ["Two Step Taqueria", "Two Step Taqueria - South"],
    ["Doug's Diner", "Doug's Diner - Katy"],
  ]) {
    assert.equal(customersStrictlyMatch(a, b), false, `${a} ≠ ${b}`);
    // Listed in the picker only.
    assert.equal(customersLooselyMatch(a, b), true, `${a} ~ ${b}`);
  }
});

test("2: a prefix-only name is listed in the picker with both names, never preselected; Baldi still is; merge needs the strict match", async () => {
  const { pg, sql } = await fresh();
  try {
    const federal = await install(sql, "Federal Grill", { machines: ["Bunn ITCB"] });
    const olive = await install(sql, "Olive Garden #1853", { machines: ["Bunn ITCB"] });
    const baldi = await install(sql, "Baldi Management Group Inc.");
    const preview = await previewCorrigoRecords(sql, file([
      ["2001", "Work Started", "Federal Grill - Katy", "Install", "", "Install", ""],
      ["2002", "Work Started", "Olive Garden", "Install", "", "Install", ""],
      ["2003", "Work Started", "Baldi Management", "Install", "", "Install", ""],
    ]));
    assert.deepEqual(
      preview.rows.map((r) => [r.action, r.jobId, r.installChoice, r.installOptions.map((o) => o.id), r.customer]),
      [
        ["create", null, null, [federal, null], "Federal Grill - Katy"],
        ["create", null, null, [olive, null], "Olive Garden"],
        ["update", baldi, baldi, [baldi, null], "Baldi Management Group Inc."],
      ],
    );
    assert.equal(preview.rows[0].installOptions[0].label, `Attach to install #${federal} (Federal Grill) · Bunn ITCB · Not Ready · no WO yet`);
    assert.equal(preview.rows[0].matchNote, `install #${federal} is on another name (Federal Grill) — not picked`);
    const res = await applyCorrigoRows(sql, preview.rows, "Chuy");
    assert.deepEqual([res.updated, res.created], [1, 2]);
    assert.equal((await installRow(sql, federal)).wo, null);

    const keep = await install(sql, "Olive Garden", { machines: ["Bunn TB3"] });
    await syncInstallUnits(sql, olive);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: olive }), /another account/);
    assert.deepEqual((await sql.query("select distinct customer from account_equipment")).map((r) => r.customer), ["Olive Garden #1853"]);
  } finally {
    await pg.close();
  }
});

test("3: Add WO refuses a WO another open install has; an install hit with the file's customer wins", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await install(sql, "Cafe Alpha", { wo: "WO-0855" });
    const b = await install(sql, "Cafe Bravo", { wo: "WO-0900" });
    await assert.rejects(() => addInstallWorkOrderFor(sql, "u-tech", { installId: b, wo: "855" }), new RegExp(`^Error: WO-0855 is on install #${a}\\. Merge the installs instead\\.$`));
    // An archived install's WO doesn't block.
    const gone = await install(sql, "Cafe Old", { wo: "WO-0777" });
    await sql.query("update installs set archived = true where id = $1", [gone]);
    assert.ok((await addInstallWorkOrderFor(sql, "u-tech", { installId: b, wo: "777" })).workOrders.some((w) => w.wo === "WO-0777"));
    // Two installs carrying one WO from before: the file's customer picks.
    await sql.query("insert into install_work_orders (install_id, wo, match_key) values ($1, 'WO-0855', '855')", [b]);
    const preview = await previewCorrigoRecords(sql, file([["0855", "Work Started", "Cafe Bravo", "Install", "", "", ""]]));
    assert.deepEqual([preview.rows[0].action, preview.rows[0].jobId], ["update", b]);
  } finally {
    await pg.close();
  }
});

test("4: a WO match keeps the install's own name; an import that does change it moves the install's units like the window", async () => {
  const { pg, sql } = await fresh();
  try {
    const baldi = await install(sql, "Baldi Management Group Inc.");
    const once = file([["0831", "Work Started", "Baldi Management", "Install", "", "", ""]]);
    await applyCorrigoRows(sql, (await previewCorrigoRecords(sql, once)).rows, "Chuy");
    const again = await previewCorrigoRecords(sql, once);
    assert.deepEqual([again.rows[0].jobId, again.rows[0].customer], [baldi, "Baldi Management Group Inc."]);
    await applyCorrigoRows(sql, again.rows, "Chuy");
    assert.equal((await installRow(sql, baldi)).customer, "Baldi Management Group Inc.");

    const zulu = await install(sql, "Cafe Zulu", { machines: ["Bunn TB3"], wo: "WO-0700" });
    await syncInstallUnits(sql, zulu);
    const renamed = await previewCorrigoRecords(sql, file([["0700", "Work Started", "Zulu Coffee Bar", "Install", "", "", ""]]));
    assert.deepEqual([renamed.rows[0].jobId, renamed.rows[0].customer], [zulu, "Zulu Coffee Bar"]);
    await applyCorrigoRows(sql, renamed.rows, "Chuy");
    assert.equal((await installRow(sql, zulu)).customer, "Zulu Coffee Bar");
    assert.deepEqual((await sql.query("select customer from account_equipment where created_by_install = $1", [zulu])).map((r) => r.customer), ["Zulu Coffee Bar"]);
  } finally {
    await pg.close();
  }
});

test("5: merge carries the deal, date, tech, recipes, warehouse units, rebuilds, the visit header and loose photos; twins' checks go where the keeper has none", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Delta Inc.", { machines: ["Bunn TB3", "Bunn ITCB"] });
    const drop = await install(sql, "Cafe Delta", { machines: ["Bunn ITCB"] });
    const deal = (await sql.query("insert into deals (customer) values ('Cafe Delta') returning id"))[0].id;
    await sql.query("update installs set deal_id = $1, install_date = '2026-11-02', technician = 'Melinda' where id = $2", [deal, drop]);
    await sql.query("update installs set technician = 'Ryan' where id = $1", [keep]);
    const recipe = (await sql.query("insert into recipes (equipment_model, customer, install_id) values ('Bunn ITCB', 'Cafe Delta', $1) returning id", [drop]))[0].id;
    const asset = (await sql.query("insert into assets (kind, model, serial, install_id, status, site) values ('equip', 'Bunn ITCB', 'W-1', $1, 'assigned', 'field') returning id", [drop]))[0].id;
    await sql.query("update assets set locked_at = now(), locked_by = 'System (assigned)' where id = $1", [asset]);
    const rebuild = (await sql.query("insert into rebuilds (title, account, install_id) values ('ITCB rebuild', 'Cafe Delta', $1) returning id", [drop]))[0]?.id;
    await sql.query("insert into install_inspections (install_id, inspector, notes) values ($1, 'melinda', 'site has 208v'), ($2, null, 'keeper note')", [drop, keep]);
    await syncInstallUnits(sql, keep);
    await syncInstallUnits(sql, drop);
    await sql.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, null, 'site', 'data:x')", [drop]);
    // The ITCB is on both visits as twins (same model, no serial). The drop checked power and water; the keeper only power.
    const unitOf = async (id) =>
      (await sql.query("select a.id from install_inspection_units u join account_equipment a on a.id = u.equipment_id where u.install_id = $1 and a.equipment_name = 'Bunn ITCB'", [id]))[0].id;
    const [keepItcb, dropItcb] = [await unitOf(keep), await unitOf(drop)];
    assert.notEqual(keepItcb, dropItcb);
    await sql.query(
      "insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'power', 'Passed'), ($1, $2, 'water', 'Failed'), ($3, $4, 'power', 'Failed')",
      [drop, dropItcb, keep, keepItcb],
    );
    await sql.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, $2, 'water', 'data:w'), ($1, $2, 'power', 'data:p'), ($3, $4, 'power', 'data:k')", [drop, dropItcb, keep, keepItcb]);

    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    const k = await installRow(sql, keep);
    assert.deepEqual([k.deal_id, k.install_date, k.technician], [deal, "2026-11-02", "Ryan"]);
    assert.equal((await sql.query("select install_id from recipes where id = $1", [recipe]))[0].install_id, keep);
    assert.equal((await sql.query("select install_id from assets where id = $1", [asset]))[0].install_id, keep);
    if (rebuild) assert.equal((await sql.query("select install_id from rebuilds where id = $1", [rebuild]))[0].install_id, keep);
    assert.deepEqual(await sql.query("select inspector, notes from install_inspections where install_id = $1", [keep]), [
      { inspector: "melinda", notes: `keeper note\n\nFrom install #${drop}: site has 208v` },
    ]);
    // The loose photo moved; the keeper's visit load then files it under its first unit, as it does any loose photo.
    assert.deepEqual((await sql.query("select install_id from install_inspection_photos where category = 'site'")).map((r) => r.install_id), [keep]);
    // Water: the keeper had nothing, so the drop's check and photo moved onto the keeper's ITCB. Power stays as it was.
    const items = await sql.query("select install_id, equipment_id, category, status from install_inspection_items order by install_id, category");
    assert.deepEqual(items, [
      { install_id: keep, equipment_id: keepItcb, category: "power", status: "Failed" },
      { install_id: keep, equipment_id: keepItcb, category: "water", status: "Failed" },
      { install_id: drop, equipment_id: dropItcb, category: "power", status: "Passed" },
    ]);
    const photos = await sql.query("select install_id, equipment_id, data_url from install_inspection_photos where category <> 'site' order by data_url");
    assert.deepEqual(photos, [
      { install_id: keep, equipment_id: keepItcb, data_url: "data:k" },
      { install_id: drop, equipment_id: dropItcb, data_url: "data:p" },
      { install_id: keep, equipment_id: keepItcb, data_url: "data:w" },
    ]);
  } finally {
    await pg.close();
  }
});

test("5: merge refuses two different deals, and a locked customer when the names aren't the same", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Echo Inc.");
    const drop = await install(sql, "Cafe Echo");
    const [d1, d2] = (await sql.query("insert into deals (customer) values ('Cafe Echo'), ('Cafe Echo') returning id")).map((r) => r.id);
    await sql.query("update installs set deal_id = $1 where id = $2", [d1, keep]);
    await sql.query("update installs set deal_id = $1 where id = $2", [d2, drop]);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }), new RegExp(`from deal #${d1}.*deal #${d2}`));
    await sql.query("update installs set deal_id = null where id = $1", [drop]);
    await sql.query("update installs set customer_locked_at = now(), customer_locked_by = 'chuy' where id = $1", [drop]);
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }), /Locked by chuy\. Only chuy can unlock it\./);
    await sql.query("update installs set customer = 'Cafe Echo Inc.' where id = $1", [drop]);
    const out = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.equal(out.keepId, keep);
  } finally {
    await pg.close();
  }
});

test("6: the merge statement locks both installs before it checks them", () => {
  const src = readFileSync(new URL("../src/lib/ops/install-projects.ts", import.meta.url), "utf8");
  assert.match(src, /from installs where id = any\(array\[\$1::int, \$2::int\]\) order by id for update/);
});

test("7: after the wrap, a reused WO on an old completed install's other WO is a new job", async () => {
  const { pg, sql } = await fresh();
  try {
    await sql.query("insert into service_jobs (kind, call_id, customer, wo, status, received, done) values ('service', 'SC-1', 'X', 'WO-9998', 'Completed', '2025-06-01', true), ('service', 'SC-2', 'Y', 'WO-10002', 'Open', '2026-10-01', false)");
    const old = await install(sql, "Cafe Echo", { wo: "WO-9100", status: "Installed", complete: true });
    await sql.query("update installs set received = '2024-09-01', completed_at = '2024-10-01' where id = $1", [old]);
    await sql.query("insert into install_work_orders (install_id, wo, match_key, status, received) values ($1, 'WO-9100', '9100', 'Completed', '2024-09-01'), ($1, 'WO-0042', '42', 'Completed', '2024-09-20')", [old]);
    const preview = await previewCorrigoRecords(sql, file([["0042", "Work Started", "Cafe Echo", "Install", "Eversys e'4m", "New install", ""]]));
    assert.deepEqual([preview.rows[0].action, preview.rows[0].jobId, preview.rows[0].wrapRepeat], ["create", null, true]);
    // A WO this cycle put on the install is still the same job.
    await sql.query("update install_work_orders set received = current_date - 20 where match_key = '42'");
    const recent = await previewCorrigoRecords(sql, file([["0042", "Work Started", "Cafe Echo", "Install", "", "", ""]]));
    assert.deepEqual([recent.rows[0].action, recent.rows[0].jobId], ["update", old]);
  } finally {
    await pg.close();
  }
});

test("8: clearing the WO # field promotes the next WO", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Charlie", { wo: "WO-0500" });
    await addInstallWorkOrderFor(sql, "u-tech", { installId: id, wo: "501" });
    await api.updateInstallFor(sql, { id, wo: null }, { userId: "u-tech" });
    assert.equal((await installRow(sql, id)).wo, "WO-0501");
    assert.deepEqual([...(await loadInstallWos(sql, [id])).get(id)].map((w) => [w.wo, w.primary]), [["WO-0501", true]]);
  } finally {
    await pg.close();
  }
});

test("9: the 0093 backfill reads a WO the way woMatchKey does", async () => {
  const { pg } = await fresh({ upTo: "0093" });
  try {
    const raw = ["WO‑0855", "WO— 0856", "WO 0831", "#0857", "WO# 0858", "ST#: 0012", "W.O. 0042", "WO-0859.0", "Work Order 1,234", " wo 0860 ", "WO #ST 0861", "ABC-12"];
    for (const wo of raw) await pg.query("insert into installs (customer, wo) values ('x', $1)", [wo]);
    await pg.exec(readFileSync(new URL("0093_install_work_orders.sql", MIGRATIONS), "utf8"));
    const keys = (await pg.query("select match_key from install_work_orders order by install_id")).rows.map((r) => r.match_key);
    assert.deepEqual(keys, raw.map((wo) => woMatchKey(wo)));
  } finally {
    await pg.close();
  }
});
