// WO part lines (10/28, Grok through Chuy): the parts each work order used, as Corrigo or NetSuite lists them, imported
// from a CSV (Admin only) so Parts usage counts the tickets since the QuickBooks history ended. A line finds its part by
// the item after its last colon and its ticket by the WO and day; a WO's part counts once (Charges, invoices and
// QuickBooks first, then Corrigo, then NetSuite). Charges are never touched. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const w = await import("../src/lib/ops/wo-part-lines.ts");
const { importWoPartLinesFor } = await import("../src/lib/ops/wo-part-lines-api.ts");
const usage = await import("../src/lib/ops/part-usage-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-grok', 'grokatron', true, false, 'admin'),
       ('u-sales', 'ana', true, false, 'sales'), ('u-tech', 'melinda', true, false, 'service'), ('u-new', 'pending', false, false, 'admin')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return { pg, sql: { query } };
}

const csv = (rows) =>
  Buffer.from(
    rows.map((row) => row.map((v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""))).join(",")).join("\r\n") + "\r\n",
    "utf8",
  ).toString("base64");
const HEAD = ["wo", "used_on", "item", "qty", "source", "source_ref"];

/* ------------------------------------------------------------------ the plain part */

test("the SKU is the item after its last colon, in capitals with no spaces", () => {
  assert.equal(w.lineSku("BUNN PARTS:BUNN40670.0005"), "BUNN40670.0005");
  assert.equal(w.lineSku("BUNN PARTS : BUNN 40670.0005"), "BUNN40670.0005");
  assert.equal(w.lineSku("A : B : ev9693-31 "), "EV9693-31");
  assert.equal(w.lineSku("bunn40670.0005"), "BUNN40670.0005");
  assert.equal(w.lineSku(null), "");
});

test("reading a row: source, qty (blank counts as 1) and the day", () => {
  assert.equal(w.readSource("Corrigo"), "corrigo");
  assert.equal(w.readSource(" Net Suite "), "netsuite");
  assert.equal(w.readSource("quickbooks"), null);
  assert.deepEqual(w.readQty(""), { qty: 1, blank: true });
  assert.deepEqual(w.readQty("2"), { qty: 2, blank: false });
  assert.deepEqual(w.readQty("-1"), { qty: -1, blank: false });
  assert.deepEqual(w.readQty("1,000"), { qty: 1000, blank: false });
  assert.equal(w.readQty("two"), undefined);
  assert.equal(w.readUsedOn("2026-09-15"), "2026-09-15");
  assert.equal(w.readUsedOn("9/15/2026"), "2026-09-15");
  assert.equal(w.readUsedOn("9/15/26"), "2026-09-15");
  assert.equal(w.readUsedOn("Sep 15, 2026"), "2026-09-15");
  assert.equal(w.readUsedOn(""), null);
  assert.equal(w.readUsedOn("2026-02-31"), undefined, "not a real day");
  assert.equal(w.readUsedOn("soon"), undefined);
  const sheet = (matrix) => [{ name: "Sheet1", matrix }];
  const { rows } = w.woRowsFromSheets(
    sheet([
      ["Source", "Item", "Used On", "WO", "Qty", "Source Ref"],
      ["corrigo", "BUNN PARTS:BUNN40670.0005", "9/12/2026", "855", "", "C-1"],
      ["", "", "", "", "", ""],
      ["NetSuite", "BUNN PARTS:GSK-20", "2026-09-13", "WO 0855", "3", ""],
    ]),
  );
  assert.deepEqual(
    rows.map((r) => [r.line, r.wo, r.woKey, r.usedOn, r.sku, r.qty, r.qtyBlank, r.source, r.sourceRef]),
    [
      [2, "WO-0855", "855", "2026-09-12", "BUNN40670.0005", 1, true, "corrigo", "C-1"],
      [4, "WO-0855", "855", "2026-09-13", "GSK-20", 3, false, "netsuite", null],
    ],
  );
  assert.throws(() => w.woRowsFromSheets(sheet([["wo", "item", "qty"], ["1", "A", "1"]])), /needs the columns wo, used_on, item and source/);
});

test("a WO finds its ticket by the day: this run's number, not the same number from before the restart", () => {
  const t = (board, id, wo, received, extra = {}) => ({ board, id, wo, label: `#${id}`, customer: null, status: null, received, completedAt: null, countsOn: `${board}:${id}`, ...extra });
  const tickets = [
    t("service", 1, "WO-0855", "2024-03-01"),
    t("service", 2, "WO-0855", "2026-09-10"),
    t("pm", 3, "WO-0855", "2026-09-11"),
    t("install", 4, "WO-0900", "2026-09-01"),
    t("service", 5, "WO-0901", null, { completedAt: "2026-09-05" }),
  ];
  assert.equal(w.ticketForLine({ woKey: "855", usedOn: "2026-09-12" }, tickets).id, 2, "a ticket before a PM, and never the 2024 one");
  assert.equal(w.ticketForLine({ woKey: "855", usedOn: "2024-03-05" }, tickets).id, 1);
  assert.equal(w.ticketForLine({ woKey: "855", usedOn: "2025-06-01" }, tickets), null, "too far from both");
  assert.equal(w.ticketForLine({ woKey: "900", usedOn: "2026-08-20" }, tickets).id, 4, "the line's day may be up to 14 days before the ticket came in");
  assert.equal(w.ticketForLine({ woKey: "900", usedOn: "2026-08-10" }, tickets), null);
  assert.equal(w.ticketForLine({ woKey: "901", usedOn: "2026-09-06" }, tickets).id, 5, "no received day: its completed day");
  assert.equal(w.ticketForLine({ woKey: "855", usedOn: null }, tickets), null);
});

/* ------------------------------------------------------------------ the database */

async function seed(pg) {
  const part = async (sku, item, description, kind = "part") =>
    (await pg.query("insert into billing_items (sku, item, description, kind) values ($1, $2, $3, $4) returning id", [sku, item, description, kind])).rows[0].id;
  const ids = {
    spray: await part("BUNN40670.0005", "BUNN PARTS : BUNN40670.0005", "Sprayhead"),
    gasket: await part("GSK-20", "PARTS : Gasket kit 20", "Gasket kit"),
    filter: await part("EV9693-31", "WATER FILTERS : EV9693-31", "Water filter"),
    trip: await part("TRIP", "TRIP", "Trip charge", "trip"),
  };
  const job = async (kind, callId, wo, received, extra = {}) =>
    (
      await pg.query(
        "insert into service_jobs (kind, call_id, customer, status, wo, received, completed_at, ns_so) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
        [kind, callId, extra.customer ?? "Alpha Cafe", extra.status ?? "Completed", wo, received, extra.completed ?? null, extra.so ?? null],
      )
    ).rows[0].id;
  const t = {
    old: await job("service", "SC-01", "WO-0855", "2024-03-01", { completed: "2024-03-02" }),
    s1: await job("service", "SC-10", "WO-0855", "2026-09-10", { completed: "2026-09-12", so: "SO-5001" }),
    s2: await job("service", "SC-20", "WO-0900", "2026-09-20", { completed: "2026-09-21" }),
    t1: await job("tlc", "TLC-30", "WO-0950", "2026-10-01", { customer: "Beta Bar" }),
  };
  await pg.query("insert into ticket_charges (job_id, item, qty, rate, kind) values ($1, 'BUNN PARTS : BUNN40670.0005', 1, 10, 'part')", [t.s2]);
  t.pm = (await pg.query("insert into pm_jobs (customer, status, wo, received, completed_at) values ('Gamma Grill', 'Completed', 'WO-0960', '2026-10-03', '2026-10-04') returning id")).rows[0].id;
  const inv = (await pg.query("insert into invoices (entity_type, entity_id, customer, approved_at) values ('pm', $1, 'Gamma Grill', '2026-10-05T15:00:00Z') returning id", [t.pm])).rows[0].id;
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate, kind) values ($1, 'WATER FILTERS : EV9693-31', 1, 30, 'part')", [inv]);
  t.install = (await pg.query("insert into installs (customer, wo, received) values ('Delta Diner', 'WO-0970', '2026-10-05') returning id")).rows[0].id;
  // QuickBooks history: WO-0211 this run (Aug 2026), and WO-0855 from the run before the restart.
  const run = (await pg.query("insert into wo_history_runs (filename) values ('made-up.csv') returning id")).rows[0].id;
  const hist = async (ref, wo, completed) =>
    (await pg.query("insert into wo_history (run_id, history_ref, wo, customer, completed) values ($1, $2, $3, 'Epsilon Eats', $4) returning id", [run, ref, wo, completed])).rows[0].id;
  const h211 = await hist("WO-0211 (2026-08-15)", "WO-0211", "2026-08-15 10:00");
  const h855 = await hist("WO-0855", "WO-0855", "2024-03-05 09:00");
  for (const h of [h211, h855]) await pg.query("insert into wo_history_lines (history_id, line_type, kind, item_code, qty) values ($1, 'Item', 'part', 'BUNN40670.0005', 1)", [h]);
  return { ids, t, h211, h855 };
}

const FILE = [
  HEAD,
  ["WO-0855", "2026-09-12", "BUNN PARTS:BUNN40670.0005", "2", "corrigo", "C-1"], // 2: on SC-10, not the 2024 ticket
  ["855", "9/12/2026", "BUNN PARTS:BUNN40670.0005", "1", "netsuite", "SO-5001"], // 3: Corrigo has it
  ["WO-0855", "2026-09-12", "BUNN PARTS:GSK-20", "", "corrigo", "C-2"], // 4: by SKU; blank qty is 1
  ["WO-0855", "2026-09-12", "BUNN PARTS:GSK-20", "2", "corrigo", "C-3"], // 5: added to line 4
  ["WO-0855", "2026-09-12", "BUNN PARTS:GSK-20", "5", "corrigo", "C-3"], // 6: the same line twice
  ["WO-0900", "2026-09-21", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 7: SC-20's Charges have it
  ["WO-0950", "2026-10-02", "WATER FILTERS:EV9693-31", "1", "netsuite", "SO-9"], // 8: on the TLC
  ["WO-0960", "2026-10-04", "WATER FILTERS:EV9693-31", "1", "corrigo", ""], // 9: the PM's invoice has it
  ["WO-0960", "2026-10-04", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 10: on the PM
  ["WO-0970", "2026-10-06", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 11: on the install
  ["WO-1234", "2026-10-10", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 12: no ticket: on its WO
  ["WO-0211", "2026-08-20", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 13: in the QuickBooks history
  ["", "2026-10-10", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 14: no WO
  ["WO-1300", "2026-10-10", "BUNN PARTS:NOPE-1", "1", "corrigo", ""], // 15: no part
  ["WO-1301", "2026-10-10", "BUNN PARTS:BUNN40670.0005", "two", "corrigo", ""], // 16: qty
  ["WO-1302", "", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""], // 17: no date
  ["WO-1303", "2026-10-10", "BUNN PARTS:BUNN40670.0005", "1", "quickbooks", ""], // 18: source
  ["WO-1304", "2026-10-10", "TRIP:TRIP", "1", "corrigo", ""], // 19: trip isn't a part
  ["WO-1305", "2026-10-11", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", "R1"], // 20 and 21: add up to 0
  ["WO-1305", "2026-10-11", "BUNN PARTS:BUNN40670.0005", "-1", "corrigo", "R2"],
];

test("only an Admin (the Admin role or a desk admin, approved) can preview or save", async () => {
  const { pg, sql } = await fresh();
  try {
    await seed(pg);
    const data = { filename: "lines.csv", base64: csv(FILE), apply: false };
    for (const who of ["u-sales", "u-tech", "u-new", "u-nobody"]) {
      await assert.rejects(() => importWoPartLinesFor(sql, data, who), /Only an Admin can import WO part lines/, who);
    }
    assert.equal((await importWoPartLinesFor(sql, data, "u-owner")).rowCount, 20);
    assert.equal((await importWoPartLinesFor(sql, data, "u-grok")).rowCount, 20, "the Admin role without the desk-admin flag");
  } finally {
    await pg.close();
  }
});

test("the preview: each row's part, ticket and result; the counts", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids, t } = await seed(pg);
    const p = await importWoPartLinesFor(sql, { filename: "lines.csv", base64: csv(FILE), apply: false }, "u-owner");
    assert.deepEqual(
      [p.add, p.noTicket, p.combined, p.duplicate, p.counted, p.noPart, p.noWo, p.invalid, p.applied],
      [6, 1, 1, 1, 4, 2, 1, 5, false],
    );
    assert.equal((await pg.query("select count(*)::int n from ticket_part_lines")).rows[0].n, 0, "the preview writes nothing");
    const at = (line) => p.lines.find((l) => l.line === line);
    assert.deepEqual([at(2).status, at(2).ticket.id, at(2).part.id, at(2).total], ["add", t.s1, ids.spray, 2]);
    assert.equal(at(2).ticket.label, "SC-10 · WO-0855");
    assert.deepEqual([at(3).status, at(3).reason], ["counted", "Corrigo has this part on WO-0855"]);
    assert.deepEqual([at(4).status, at(4).part.id, at(4).total, at(4).totalBlank, at(4).refs], ["add", ids.gasket, 3, true, ["C-2", "C-3"]]);
    assert.match(at(4).reason, /A blank qty counts as 1/);
    assert.deepEqual([at(5).status, at(5).into], ["combined", 4]);
    assert.deepEqual([at(6).status, at(6).reason], ["duplicate", "Line 4 has the same source_ref"]);
    assert.deepEqual([at(7).status, at(7).reason], ["counted", "Already counted on SC-20 · WO-0900"]);
    assert.deepEqual([at(8).status, at(8).ticket.board, at(8).ticket.id], ["add", "tlc", t.t1]);
    assert.deepEqual([at(9).status, at(9).reason], ["counted", "Already counted on PM WO-0960"]);
    assert.deepEqual([at(10).status, at(10).ticket.board], ["add", "pm"]);
    assert.deepEqual([at(11).status, at(11).ticket.board, at(11).ticket.id], ["add", "install", t.install]);
    assert.deepEqual([at(12).status, at(12).ticket, at(12).reason], ["add", null, "No ticket: saved on its WO"]);
    assert.deepEqual([at(13).status, at(13).reason], ["counted", "Already in the QuickBooks history (WO-0211)"]);
    assert.deepEqual([at(14).status, at(15).status, at(19).status], ["no_wo", "no_part", "no_part"]);
    assert.deepEqual([16, 17, 18, 20, 21].map((n) => [at(n).status, at(n).reason]), [
      ["invalid", "Can't read the qty"],
      ["invalid", "No date"],
      ["invalid", 'Source "quickbooks": corrigo or netsuite'],
      ["invalid", "The qty adds up to 0 or less"],
      ["invalid", "With line 20: The qty adds up to 0 or less"],
    ]);
  } finally {
    await pg.close();
  }
});

test("Save adds the lines, Parts usage counts them on their tickets, and Charges don't change", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids, t, h211, h855 } = await seed(pg);
    const charges = async () => (await pg.query("select job_id, item, qty from ticket_charges order by id")).rows;
    const chargesBefore = await charges();
    const saved = await importWoPartLinesFor(sql, { filename: "lines.csv", base64: csv(FILE), apply: true }, "u-grok");
    assert.deepEqual([saved.add, saved.duplicate, saved.applied], [6, 1, true]);
    const rows = (await pg.query("select job_id, pm_id, install_id, wo, sku, qty::float8 as qty, qty_blank, source, source_ref, imported_by from ticket_part_lines order by id")).rows;
    assert.equal(rows.length, 6);
    const gasket = rows.find((r) => r.sku === "GSK-20");
    assert.deepEqual([gasket.job_id, gasket.wo, gasket.qty, gasket.qty_blank, gasket.source_ref, gasket.imported_by], [t.s1, "WO-0855", 3, true, "C-2, C-3", "grokatron"]);
    assert.deepEqual(rows.find((r) => r.wo === "WO-0960").pm_id, t.pm);
    assert.deepEqual(rows.find((r) => r.wo === "WO-0970").install_id, t.install);
    assert.deepEqual([rows.find((r) => r.wo === "WO-1234").job_id, rows.find((r) => r.wo === "WO-1234").pm_id], [null, null]);
    assert.deepEqual(await charges(), chargesBefore, "Charges are untouched");

    const uses = await usage.loadPartUses(sql);
    const of = (id) => uses.filter((u) => u.partId === id).map((u) => `${u.ticketKey}=${u.pieces}:${u.type}:${u.source}`).sort();
    assert.deepEqual(
      of(ids.spray),
      [
        `service:${t.s1}=2:service:corrigo`,
        `service:${t.s2}=1:service:desk`,
        `pm:${t.pm}=1:pm:corrigo`,
        `install:${t.install}=1:install:corrigo`,
        "wo:WO-1234=1:corrigo:corrigo",
        `qb:${h211}=1:quickbooks:quickbooks`,
        `qb:${h855}=1:quickbooks:quickbooks`,
      ].sort(),
    );
    assert.deepEqual(of(ids.gasket), [`service:${t.s1}=3:service:corrigo`]);
    assert.deepEqual(of(ids.filter), [`pm:${t.pm}=1:pm:desk`, `tlc:${t.t1}=1:tlc:netsuite`].sort());
    const s1 = uses.find((u) => u.ticketKey === `service:${t.s1}` && u.partId === ids.spray);
    assert.deepEqual([s1.usedOn, s1.label, s1.customer, s1.refId], ["2026-09-12", "SC-10 · WO-0855", "Alpha Cafe", t.s1]);
    const loose = uses.find((u) => u.ticketKey === "wo:WO-1234");
    assert.deepEqual([loose.type, loose.label, loose.customer, loose.usedOn], ["corrigo", "WO-1234", null, "2026-10-10"]);
    // September and October now have uses; the report filters lines with no ticket by their source.
    const fall = await usage.loadPartUses(sql, { from: "2026-09-01", to: "2026-10-31" });
    assert.equal(fall.filter((u) => u.source === "corrigo" || u.source === "netsuite").length, 6);
    assert.deepEqual((await usage.loadPartUses(sql, { types: ["corrigo"] })).map((u) => u.ticketKey), ["wo:WO-1234"]);
    assert.deepEqual((await usage.partUsageCounts(sql, [ids.gasket]))[ids.gasket], { tickets: 1, pieces: 3, firstUsed: "2026-09-12", lastUsed: "2026-09-12" });

    // The same file again adds nothing.
    const again = await importWoPartLinesFor(sql, { filename: "lines.csv", base64: csv(FILE), apply: true }, "u-grok");
    assert.deepEqual([again.add, again.duplicate, again.counted, again.combined], [0, 8, 4, 0]);
    assert.equal((await pg.query("select count(*)::int n from ticket_part_lines")).rows[0].n, 6);
  } finally {
    await pg.close();
  }
});

test("Corrigo wins over NetSuite for a WO's part, whichever was imported first", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids } = await seed(pg);
    const ns = csv([HEAD, ["WO-1400", "2026-10-12", "BUNN PARTS:BUNN40670.0005", "3", "netsuite", "SO-77"]]);
    assert.equal((await importWoPartLinesFor(sql, { filename: "ns.csv", base64: ns, apply: true }, "u-owner")).add, 1);
    const pieces = async () => (await usage.loadPartUses(sql, { partIds: [ids.spray] })).filter((u) => u.ticketKey === "wo:WO-1400").map((u) => `${u.source}=${u.pieces}`);
    assert.deepEqual(await pieces(), ["netsuite=3"]);
    const co = csv([HEAD, ["WO-1400", "2026-10-12", "BUNN PARTS:BUNN40670.0005", "2", "corrigo", "C-77"]]);
    const preview = await importWoPartLinesFor(sql, { filename: "co.csv", base64: co, apply: false }, "u-owner");
    assert.match(preview.lines[0].reason, /Counts instead of the NetSuite line/);
    await importWoPartLinesFor(sql, { filename: "co.csv", base64: co, apply: true }, "u-owner");
    assert.deepEqual(await pieces(), ["corrigo=2"], "one use, from Corrigo");
    assert.equal((await pg.query("select count(*)::int n from ticket_part_lines where wo = 'WO-1400'")).rows[0].n, 2, "the NetSuite line stays saved");
  } finally {
    await pg.close();
  }
});

test("up to 5,000 rows a file, and a file without the columns says which it needs", async () => {
  const { pg, sql } = await fresh();
  try {
    await seed(pg);
    const big = [HEAD, ...Array.from({ length: 5001 }, (_, i) => [`WO-${2000 + i}`, "2026-10-10", "BUNN PARTS:BUNN40670.0005", "1", "corrigo", ""])];
    await assert.rejects(() => importWoPartLinesFor(sql, { filename: "big.csv", base64: csv(big), apply: false }, "u-owner"), /Up to 5,000 rows at a time; this file has 5,001/);
    await assert.rejects(() => importWoPartLinesFor(sql, { filename: "x.csv", base64: csv([["wo", "part"], ["1", "A"]]), apply: false }, "u-owner"), /needs the columns/);
    await assert.rejects(() => importWoPartLinesFor(sql, { filename: "x.csv", base64: csv([HEAD]), apply: false }, "u-owner"), /No rows under the header/);
  } finally {
    await pg.close();
  }
});
