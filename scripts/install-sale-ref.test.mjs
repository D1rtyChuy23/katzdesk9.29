// An install's sale, for reference (Chuy, 11/3): "A PO for an equipment sale is not for the install visit, but the sale
// the install fee is added so it would be good to reference the sale in the install." The deal's P.O. stays the deal's;
// an install made from a deal shows that deal's Sale Invoice # or Sales Order # and P.O. on its card, its Details and the
// account page, and search finds the install by them. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const P = await import("../src/lib/ops/ticket-po.ts");
const api = await import("../src/lib/ops/api.ts");
const { withSales } = await import("../src/lib/ops/install-sale.ts");
const { getInvoiceFor } = await import("../src/lib/ops/invoice-api.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { addDays, todayChicago, weekBounds } = await import("../src/lib/ops/clock.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const CAFE = "Test Roastery - Midtown";
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'boss', true, true, 'admin'),
       ('u-tech', 'tess', true, false, 'service')`,
  );
  await pg.query("insert into directory_customers (name, account_number, address) values ($1, 'TEST-SALE-1', '9 Test Ave')", [CAFE]);
  return { pg, sql };
}
const one = async (pg, text, params) => (await pg.query(text, params)).rows[0];
const insertRow = async (pg, table, f) => {
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into ${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
};
let n = 0;
const deal = (pg, f = {}) => insertRow(pg, "deals", { customer: CAFE, ...f });
const install = (pg, f = {}) => insertRow(pg, "installs", { received: addDays(todayChicago(), -4), customer: CAFE, equip_status: "Not Ready", wo: `WO-${8400 + ++n}`, ...f });
const readInstalls = async (sql) => {
  const today = todayChicago();
  return (await sql`select * from installs order by id`).map((r) => api.mapInstall(r, today, weekBounds(today)));
};

test("an install's sale line, and the top search's note: the number typed exactly, else the first that has it", () => {
  assert.equal(P.saleRefLine({ invoice: " INV-500 ", po: " SALE-1 " }), "Sale Invoice/SO INV-500 · Sale P.O. SALE-1");
  assert.equal(P.saleRefLine({ invoice: "SO-77", po: null }), "Sale Invoice/SO SO-77");
  assert.equal(P.saleRefLine({ invoice: "  ", po: "4455" }), "Sale P.O. 4455");
  assert.equal(P.saleRefLine({ invoice: null, po: " " }), null);
  assert.equal(P.saleRefLine(null), null);
  assert.equal(P.saleRefLine(undefined), null);
  const install = (r) => [["P.O.", r.po], ["Vendor P.O.", r.vendorPo], ["Sale P.O.", r.salePo], ["Sale Invoice/SO", r.saleInvoice]];
  // The one typed exactly wins over an earlier one that only contains it.
  assert.equal(P.numberNote("abc-123", install({ vendorPo: "ABC-123-V", salePo: "ABC-123" })), " · Sale P.O. ABC-123");
  assert.equal(P.numberNote(" so-55501 ", install({ po: "SO-55501-X", saleInvoice: " SO-55501 " })), " · Sale Invoice/SO SO-55501");
  // Else the first, in order, that contains it.
  assert.equal(P.numberNote("abc", install({ po: "X-ABC", vendorPo: "ABC-1" })), " · P.O. X-ABC");
  assert.equal(P.numberNote("LE-", install({ salePo: "SALE-1" })), " · Sale P.O. SALE-1");
  assert.equal(P.numberNote("zz", install({ po: "ABC", salePo: "SALE-1" })), "");
  assert.equal(P.numberNote("  ", install({ salePo: "SALE-1" })), "");
  assert.equal(P.numberNote("SALE", install({})), "");
  // A ticket's or a deal's note works the same way.
  assert.equal(P.poSearchNote("445", { po: "4455", vendor_po: "445" }), " · Vendor P.O. 445");
  assert.equal(P.poSearchNote("445", { po: "4455", vendor_po: "4459" }), " · P.O. 4455");
});

test("a board's exact match takes a row's other numbers too: an install found by its sale's P.O. or number in any view", () => {
  const a = { id: 1, po: null, vendorPo: null, sale: { po: "SALE-9", invoice: "INV-9" } };
  const b = { id: 2, po: "OWN-2", vendorPo: null, sale: null };
  const more = (r) => [r.sale?.po, r.sale?.invoice];
  // The view shows only b; an exact sale P.O. or number brings a in first, whatever the view.
  assert.deepEqual(P.withPoMatches([b], [a, b], " sale-9 ", more).map((r) => r.id), [1, 2]);
  assert.deepEqual(P.withPoMatches([b], [a, b], "INV-9", more).map((r) => r.id), [1, 2]);
  // Only exact: part of it is left to the search box's own filter.
  assert.deepEqual(P.withPoMatches([b], [a, b], "SALE", more).map((r) => r.id), [2]);
  // Without `more`, the sale's numbers don't count; a row's own P.O. still does.
  assert.deepEqual(P.withPoMatches([b], [a, b], "SALE-9").map((r) => r.id), [2]);
  assert.deepEqual(P.withPoMatches([a], [a, b], "own-2", more).map((r) => r.id), [2, 1]);
  // Under 2 characters, the view as is.
  assert.deepEqual(P.withPoMatches([b], [a, b], "S", more).map((r) => r.id), [2]);
});

test("each install's sale is its deal's Sale Invoice/SO # and P.O., read as they are now, and never copied onto the install", async () => {
  const { pg, sql } = await fresh();
  try {
    const sold = await deal(pg, { invoice: " INV-500 ", po: " SALE-PO-1 " });
    const bare = await deal(pg, { invoice: null, po: "  " });
    const fromSale = await install(pg, { deal_id: sold });
    const fromBare = await install(pg, { deal_id: bare });
    const own = await install(pg);
    const gone = await install(pg, { deal_id: 99999 });
    const second = await install(pg, { deal_id: sold });
    let rows = await withSales(sql, await readInstalls(sql));
    const byId = (id) => rows.find((r) => r.id === id);
    assert.deepEqual(byId(fromSale).sale, { dealId: sold, invoice: "INV-500", po: "SALE-PO-1" });
    assert.deepEqual(byId(second).sale, { dealId: sold, invoice: "INV-500", po: "SALE-PO-1" });
    assert.deepEqual(byId(fromBare).sale, { dealId: bare, invoice: null, po: null });
    assert.equal(byId(own).sale, null);
    assert.equal(byId(gone).sale, null);
    // The sale's P.O. is the deal's: the install's own Customer P.O. (its invoice's) stays empty.
    assert.equal(byId(fromSale).po, null);
    assert.equal((await one(pg, "select po from installs where id = $1", [fromSale])).po, null);

    // A change on the deal shows the next time the install is read: nothing was copied.
    await api.updateDealFor(sql, { id: sold, po: "SALE-PO-2", invoice: "SO-600" }, "u-owner");
    rows = await withSales(sql, await readInstalls(sql));
    assert.deepEqual(byId(fromSale).sale, { dealId: sold, invoice: "SO-600", po: "SALE-PO-2" });
    // A deal removed from the Pipeline is no sale: there is nothing left there to open or change.
    await pg.query("update deals set archived = true where id = $1", [sold]);
    rows = await withSales(sql, await readInstalls(sql));
    assert.equal(byId(fromSale).sale, null);
    assert.equal(byId(second).sale, null);
    assert.deepEqual(byId(fromBare).sale, { dealId: bare, invoice: null, po: null });
    // No installs, no read.
    assert.deepEqual(await withSales(sql, []), []);
  } finally {
    await pg.close();
  }
});

test("an install's save hands back its sale, so the sheet keeps showing it", async () => {
  const { pg, sql } = await fresh();
  try {
    const sold = await deal(pg, { invoice: "INV-71", po: "SALE-71" });
    const i = await install(pg, { deal_id: sold });
    const saved = await api.updateInstallFor(sql, { id: i, notes: "Dock at back" }, { userId: "u-tech" });
    assert.deepEqual(saved.sale, { dealId: sold, invoice: "INV-71", po: "SALE-71" });
    const plain = await api.updateInstallFor(sql, { id: await install(pg), notes: "Side door" }, { userId: "u-tech" });
    assert.equal(plain.sale, null);
  } finally {
    await pg.close();
  }
});

test("a deal handed off makes its install with none of the deal's P.O.s; the install shows the sale, and its invoice only its own P.O.", async () => {
  const { pg, sql } = await fresh();
  try {
    const d = await deal(pg, { invoice: "SO-1001", po: "CUST-PO-77", vendor_po: "VEN-77" });
    await api.updateDealFor(sql, { id: d, completion: "complete" }, "u-owner");
    const made = await one(pg, "select id, po, vendor_po from installs where deal_id = $1", [d]);
    assert.ok(made, "the handoff made an install");
    assert.deepEqual({ po: made.po, vendor_po: made.vendor_po }, { po: null, vendor_po: null });
    const rows = await withSales(sql, await readInstalls(sql));
    assert.deepEqual(rows.find((r) => r.id === made.id).sale, { dealId: d, invoice: "SO-1001", po: "CUST-PO-77" });
    // The install's invoice carries the install's own Customer P.O., never the sale's; the deal's carries the deal's.
    assert.equal((await getInvoiceFor(sql, { type: "install", id: made.id }, "u-owner")).po, null);
    await api.updateInstallFor(sql, { id: made.id, po: "INST-PO-1" }, { userId: "u-owner" });
    assert.equal((await getInvoiceFor(sql, { type: "install", id: made.id }, "u-owner")).po, "INST-PO-1");
    assert.equal((await getInvoiceFor(sql, { type: "deal", id: d }, "u-owner")).po, "CUST-PO-77");
  } finally {
    await pg.close();
  }
});

test("Merge installs: the install kept takes the dropped one's deal when it has none, and shows that sale", async () => {
  const { pg, sql } = await fresh();
  try {
    const d = await deal(pg, { invoice: "INV-9", po: "SALE-9" });
    const keep = await install(pg);
    const drop = await install(pg, { deal_id: d });
    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    const rows = await withSales(sql, await readInstalls(sql));
    assert.deepEqual(rows.find((r) => r.id === keep).sale, { dealId: d, invoice: "INV-9", po: "SALE-9" });
    assert.equal(rows.find((r) => r.id === keep).po, null);
  } finally {
    await pg.close();
  }
});

test("the top search finds an install by its sale's P.O. or number and says so: the number typed exactly, else its own P.O. first", async () => {
  const { pg, sql } = await fresh();
  try {
    const sold = await deal(pg, { invoice: "INV-88", po: "SALE-PO-88" });
    const fromSale = await install(pg, { deal_id: sold });
    const ownToo = await install(pg, { deal_id: sold, po: "SALE-PO-88-B" });
    const archived = await install(pg, { deal_id: sold, archived: true });
    const unrelated = await install(pg, { po: "OTHER-1" });
    const find = async (q) => api.searchAllFor(sql, { q }, { userId: "u-owner" });
    const hits = await find("sale-po-88");
    const ins = hits.filter((h) => h.entityType === "install");
    assert.deepEqual(ins.map((h) => h.id).sort((x, y) => x - y), [fromSale, ownToo].sort((x, y) => x - y));
    assert.match(ins.find((h) => h.id === fromSale).subtitle, / · Sale P\.O\. SALE-PO-88$/);
    // Typed exactly, the sale's P.O. is named, though the install's own P.O. contains it too.
    assert.match(ins.find((h) => h.id === ownToo).subtitle, / · Sale P\.O\. SALE-PO-88$/);
    // When both only contain what was typed, the install's own P.O. comes first.
    assert.match((await find("po-88")).find((h) => h.entityType === "install" && h.id === ownToo).subtitle, / · P\.O\. SALE-PO-88-B$/);
    assert.ok(!ins.some((h) => h.id === archived || h.id === unrelated));
    // The deal itself is found by its P.O., as before.
    assert.ok(hits.some((h) => h.entityType === "deal" && h.id === sold && / · P\.O\. SALE-PO-88$/.test(h.subtitle)));
    // Text that isn't a P.O. gets no note.
    const byName = (await find("Roastery")).filter((h) => h.entityType === "install" && h.id === fromSale);
    assert.equal(byName.length, 1);
    assert.doesNotMatch(byName[0].subtitle, /P\.O\./);
    // The Sale Invoice/SO # finds the install and the deal, and says so.
    const bySale = await find("inv-88");
    assert.match(bySale.find((h) => h.entityType === "install" && h.id === fromSale).subtitle, / · Sale Invoice\/SO INV-88$/);
    assert.match(bySale.find((h) => h.entityType === "deal" && h.id === sold).subtitle, / · Sale Invoice\/SO INV-88$/);
    // Typed exactly, the sale's P.O. is named over a Vendor P.O. that only contains it.
    await pg.query("update installs set vendor_po = 'SALE-PO-88-V' where id = $1", [fromSale]);
    assert.match((await find("SALE-PO-88")).find((h) => h.entityType === "install" && h.id === fromSale).subtitle, / · Sale P\.O\. SALE-PO-88$/);
    // A deal removed from the Pipeline: its installs aren't found by its numbers any more.
    await pg.query("update deals set archived = true where id = $1", [sold]);
    assert.deepEqual((await find("INV-88")).filter((h) => h.entityType === "install"), []);
  } finally {
    await pg.close();
  }
});

test("the Installs board, the account page and a saved install read each install's sale", () => {
  const code = src("src/lib/ops/api.ts");
  assert.match(code, /\n\t\/\/ Each install's sale, from the deal it came from \(11\/3\)\.\n\treturn withSales\(sql, await withWorkOrders\(sql, await withInspections\(sql, applyMarks\(installs, marks\)\)\)\);\n\}\);/);
  assert.match(code, /\n\t\tinstalls: await withSales\(sql, await withWorkOrders\(sql, await withInspections\(sql, applyMarks\(installs\.map\(\(r\) => mapInstall\(r, today, week, catalog\)\), marks\)\)\)\),\n/);
  assert.match(code, /const saved = \(await withSales\(sql, await withWorkOrders\(sql, await withInspections\(sql, applyMarks\(\[mapInstall\(/);
  // The top search's install block joins the install's deal (not a removed one) and matches its P.O. and number.
  assert.match(code, /d\.po as sale_po, d\.invoice as sale_invoice from installs i\n\s+left join deals d on d\.id = i\.deal_id and d\.archived = false\n/);
  assert.match(code, /or coalesce\(d\.po, ''\) ilike \$1 or coalesce\(d\.invoice, ''\) ilike \$1\)\n\s+limit 5`/);
});

test("the install's card, Details and account row show its sale, and the Installs search finds it by the sale's numbers", () => {
  const board = src("src/routes/_app/installs.tsx");
  // The search box's text match and the exact match, in any lane.
  assert.match(board, /i\.po, i\.vendorPo, i\.sale\?\.po, i\.sale\?\.invoice, \.\.\.\(i\.machines/);
  assert.match(board, /list = withPoMatches\(list, data\.data \?\? \[\], q, \(i\) => \[i\.sale\?\.po, i\.sale\?\.invoice\]\);/);
  // The card: "From the deal", the link to the deal, then the sale's numbers, as one line; only while the deal is on the Pipeline.
  assert.match(
    board,
    /\{i\.sale \? \([\s\S]{0,300}<p className="[^"]*\[overflow-wrap:anywhere\][^"]*" data-testid="install-sale">\s*<OpenLink entityType="deal" id=\{i\.sale\.dealId\}[^>]*>\s*From the deal\s*<\/OpenLink>\s*\{saleRefLine\(i\.sale\) \? <span data-testid="install-sale-line"> · \{saleRefLine\(i\.sale\)\}<\/span> : null\}\s*<\/p>/,
  );
  assert.doesNotMatch(board, /\{i\.dealId \? \(/);
  // The Details: a read-only box after the P.O. boxes.
  const sheets = src("src/components/desk/entity-sheets.tsx");
  assert.match(sheets, /<PoFields idPrefix=\{`install-\$\{row\.id\}`\} po=\{row\.po\} vendorPo=\{row\.vendorPo\} \/>\n\s+\{\/\* [^*]+\*\/\}\n\s+<SaleRef sale=\{row\.sale\} \/>/);
  const fields = src("src/components/desk/po-fields.tsx");
  const saleRef = fields.slice(fields.indexOf("export function SaleRef"));
  assert.match(saleRef, /^export function SaleRef\(\{ sale \}: \{ sale: InstallSale \| null \| undefined \}\) \{\n\s+if \(!sale\) return null;\n\s+const line = saleRefLine\(sale\);/);
  assert.match(saleRef, /\{line \?\? "The deal has no Sale Invoice\/SO # or P\.O\. yet\."\}/);
  assert.match(saleRef, /Change them on the deal, in the Pipeline\./);
  // Read only: no box, so nothing of the sale's is ever sent with the install's save.
  assert.doesNotMatch(saleRef, /<Input|<input|name=/);
  // The account page's install row.
  assert.match(src("src/components/desk/account-history.tsx"), /subtitle: \[i\.equipment, poCardLine\(i\), saleRefLine\(i\.sale\)\]\.filter\(Boolean\)\.join\(" · "\),/);
});
