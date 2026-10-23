// Customers → Export and Customers → Possible Duplicates (10/23, Grok's request). Both read-only: these tests also
// check that running them changes nothing. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import * as XLSX from "xlsx";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { splitSiteAddress, chicagoStamp, sourceOf, customerExportRows, csvCell, toCsv, CUSTOMER_EXPORT_COLUMNS } = await import("../src/lib/ops/customer-export.ts");
const { phoneKey, emailKey, placeOf, rateSigns, findPossibleDuplicates, dupeCsvRows, DUPE_CSV_COLUMNS, SHARED } = await import("../src/lib/ops/customer-dupes.ts");
const { loadExportAccounts, customerExportFile, accountsAddedByRun, possibleDuplicatesFor, dupeRuns } = await import("../src/lib/ops/customer-review-api.ts");
const { applyNetsuitePlan, previewNetsuitePlan } = await import("../src/lib/ops/netsuite-customers-api.ts");
const { readNetsuiteMatrix } = await import("../src/lib/ops/netsuite-customers.ts");
const { matrixFromBase64 } = await import("../src/lib/ops/netsuite-customers-sheet.ts");

const col = (name) => CUSTOMER_EXPORT_COLUMNS.indexOf(name);

// ── Export ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test("a one-line site address splits into street, suite, city, state and ZIP; anything unclear stays whole", () => {
  assert.deepEqual(splitSiteAddress("1200 Smith Street, Suite 1600, Houston, TX 77002"), {
    line1: "1200 Smith Street",
    line2: "Suite 1600",
    city: "Houston",
    state: "TX",
    zip: "77002",
  });
  assert.deepEqual(splitSiteAddress("5644 NAVIGATION BLVD, HOUSTON, TX, 77011"), { line1: "5644 NAVIGATION BLVD", line2: "", city: "HOUSTON", state: "TX", zip: "77011" });
  assert.deepEqual(splitSiteAddress("1 Main St, Austin, tx 78701-1234, USA"), { line1: "1 Main St", line2: "", city: "Austin", state: "TX", zip: "78701-1234" });
  assert.deepEqual(splitSiteAddress("Houston, TX 77002"), { line1: "", line2: "", city: "Houston", state: "TX", zip: "77002" });
  assert.deepEqual(splitSiteAddress("900 Harbor Street, Houston TX 77002"), { line1: "900 Harbor Street", line2: "", city: "Houston", state: "TX", zip: "77002" });
  assert.deepEqual(splitSiteAddress("77 Lamar Blvd., Austin, Texas 78704"), { line1: "77 Lamar Blvd.", line2: "", city: "Austin", state: "TX", zip: "78704" });
  assert.deepEqual(splitSiteAddress("9 Elm St, Dallas, TX"), { line1: "9 Elm St", line2: "", city: "Dallas", state: "TX", zip: "" });
  assert.deepEqual(splitSiteAddress("1 King St W, Toronto, ON M5H 1A1, Canada"), { line1: "1 King St W, Toronto, ON M5H 1A1, Canada", line2: "", city: "", state: "", zip: "" });
  assert.deepEqual(splitSiteAddress(""), { line1: "", line2: "", city: "", state: "", zip: "" });
  assert.deepEqual(splitSiteAddress(null), { line1: "", line2: "", city: "", state: "", zip: "" });
});

test("when and how an account was added: Chicago time, and the NetSuite import named with its day", () => {
  assert.equal(chicagoStamp("2026-10-23T14:44:10Z"), "2026-10-23 09:44");
  assert.equal(chicagoStamp("2026-01-05T03:00:00Z"), "2026-01-04 21:00");
  assert.equal(chicagoStamp(null), "");
  assert.equal(sourceOf({ at: "2026-10-23T14:44:10Z", by: "chuy", detail: "Added by the NetSuite import (NetSuite ID 12)" }), "NetSuite import 2026-10-23, by chuy");
  assert.equal(sourceOf({ at: "2026-10-20T15:00:00Z", by: null, detail: "added" }), "Added in KatzDesk 2026-10-20");
  assert.equal(sourceOf(null), "Not recorded");
});

const exportAcct = (o) => ({
  id: o.id,
  name: o.name,
  netsuiteId: o.netsuiteId ?? null,
  accountNumber: o.accountNumber ?? null,
  address: o.address ?? null,
  billing: { line1: null, line2: null, city: null, state: null, zip: null, country: null, ...(o.billing ?? {}) },
  phone: o.phone ?? null,
  email: o.email ?? null,
  rep: o.rep ?? null,
  archived: !!o.archived,
  inactive: !!o.inactive,
  removalFlag: !!o.removalFlag,
  added: o.added ?? null,
});

test("one row per account in Grok's columns: IDs and numbers exactly as stored, and the Walk-In, Inactive and Removed marks", () => {
  const rows = customerExportRows([
    exportAcct({ id: 7, name: "Zeta Cafe", archived: true }),
    exportAcct({
      id: 3,
      name: "Alpha Coffee",
      netsuiteId: "000123456789012",
      accountNumber: "00042",
      address: "1 Main St, Ste 5, Houston, TX 77002",
      billing: { line1: "PO Box 9", city: "Houston", state: "TX", zip: "77001" },
      phone: "(713) 555-0100",
      email: "pat@alpha.test",
      rep: "Amanda Logg",
      inactive: true,
      added: { at: "2026-10-23T14:44:10Z", by: "chuy", detail: "Added by the NetSuite import (NetSuite ID 000123456789012)" },
    }),
    exportAcct({ id: 5, name: "Walk - In: Houston", removalFlag: true }),
  ]);
  assert.deepEqual(
    rows.map((r) => r[col("Name")]),
    ["Alpha Coffee", "Walk - In: Houston", "Zeta Cafe"],
    "sorted by name",
  );
  const [alpha, walkIn, zeta] = rows;
  assert.equal(alpha.length, CUSTOMER_EXPORT_COLUMNS.length);
  assert.equal(alpha[col("KatzDesk ID")], "3");
  assert.equal(alpha[col("NetSuite Internal ID")], "000123456789012", "never a number, never 1.2E+14");
  assert.equal(alpha[col("Account Number")], "00042", "leading zeros kept");
  assert.deepEqual(
    ["Site Address 1", "Site Address 2", "Site City", "Site State", "Site Zip"].map((c) => alpha[col(c)]),
    ["1 Main St", "Ste 5", "Houston", "TX", "77002"],
  );
  assert.equal(alpha[col("Billing Address")], "PO Box 9, Houston, TX 77001");
  assert.equal(alpha[col("Phone")], "(713) 555-0100");
  assert.equal(alpha[col("Email")], "pat@alpha.test");
  assert.equal(alpha[col("Rep")], "Amanda Logg");
  assert.equal(alpha[col("Created At")], "2026-10-23 09:44");
  assert.equal(alpha[col("Created By / Source")], "NetSuite import 2026-10-23, by chuy");
  assert.deepEqual([alpha[col("Walk-In")], alpha[col("Inactive")], alpha[col("Removed")]], ["", "Yes", ""]);
  assert.deepEqual([walkIn[col("Walk-In")], walkIn[col("Flagged For Review")]], ["Yes", "Yes"]);
  assert.deepEqual([zeta[col("Removed")], zeta[col("Created At")], zeta[col("Created By / Source")]], ["Yes", "", "Not recorded"]);
});

test("the CSV quotes what needs it, and a cell can't start a spreadsheet formula", () => {
  assert.equal(csvCell("Smith, Jones & Co"), '"Smith, Jones & Co"');
  assert.equal(csvCell('The "Best" Cafe'), '"The ""Best"" Cafe"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("@cafe"), "'@cafe");
  assert.equal(csvCell("-12"), "-12");
  assert.equal(csvCell("00042"), "00042");
  assert.equal(toCsv(["A", "B"], [["1", "x,y"]]), 'A,B\r\n1,"x,y"\r\n');
});

// ── Possible duplicates ───────────────────────────────────────────────────────────────────────────────────────────────

test("phones by their last 10 digits, emails lower-cased, and addresses compared with St/Street, Suite/Ste/# and punctuation set aside", () => {
  assert.equal(phoneKey("(713) 555-0199 ext. 12"), "7135550199");
  assert.equal(phoneKey("+1 713.555.0199"), "7135550199");
  assert.equal(phoneKey("713-555-0199 / 713-555-0100"), "7135550199");
  assert.equal(phoneKey("555-0199"), "", "too short to compare");
  assert.equal(emailKey("Pat@Alpha.TEST; ops@alpha.test"), "pat@alpha.test");
  assert.equal(emailKey("none"), "");
  const a = placeOf("1200 Smith Street, Suite 1600, Houston, TX 77002");
  const b = placeOf("1200 Smith St. #1600, Houston, Texas 77002");
  assert.deepEqual(a, { street: "1200 smith st", unit: "1600", zip: "77002", city: "houston" });
  assert.equal(b.street, a.street);
  assert.equal(b.unit, a.unit);
  assert.equal(placeOf("PO Box 9, Houston, TX 77001"), null);
  assert.equal(placeOf("Houston, TX 77002"), null, "no street, no place");
});

test("ratings: High needs the same site address and one more sign; a name alone is never High", () => {
  assert.equal(rateSigns(["address", "name"]), "high");
  assert.equal(rateSigns(["address", "phone"]), "high");
  assert.equal(rateSigns(["address", "domain"]), "high");
  assert.equal(rateSigns(["address"]), "medium");
  assert.equal(rateSigns(["phone", "similar"]), "medium");
  assert.equal(rateSigns(["phone", "email"]), "medium");
  assert.equal(rateSigns(["name", "domain"]), "medium");
  assert.equal(rateSigns(["name", "street"]), "medium");
  for (const one of ["name", "similar", "phone", "email", "domain", "street"]) assert.equal(rateSigns([one]), "low", one);
  assert.equal(rateSigns(["name", "similar"]), "low");
});

const dupe = (o) => ({
  id: o.id,
  name: o.name,
  address: o.address ?? null,
  phone: o.phone ?? null,
  email: o.email ?? null,
  netsuiteId: o.netsuiteId ?? null,
  accountNumber: o.accountNumber ?? null,
  inactive: !!o.inactive,
  history: o.history ?? 0,
});
const pairOf = (pairs, a, b) => pairs.find((p) => (p.added.id === a && p.other.id === b) || (p.added.id === b && p.other.id === a));

test("the import's new accounts against the rest: reasons, rating, and which to keep (never a Walk-In)", () => {
  const accounts = [
    // Already in KatzDesk.
    dupe({ id: 1, name: "Joe's Coffee", address: "12 Elm Street, Suite 4, Houston, TX 77002", phone: "713-555-0101", email: "joe@joescoffee.test", history: 12, accountNumber: "5521" }),
    dupe({ id: 2, name: "Black Rifle Coffee Company", address: "9 Oak Ave, Austin, TX 78701", history: 3 }),
    dupe({ id: 3, name: "Walk - In: Austin", address: "77 Lamar Blvd, Austin, TX 78704", phone: "512-555-0177" }),
    dupe({ id: 4, name: "Federal Grill", address: "1 Park Pl, Houston, TX 77006", email: "gm@federalgrill.test", history: 1 }),
    dupe({ id: 5, name: "Midtown Market Cafe", address: "400 Main St, Ste 100, Houston, TX 77002" }),
    dupe({ id: 6, name: "Quiet Tea", phone: "(281) 555-0123", email: "owner@gmail.com" }),
    // Added by the import.
    dupe({ id: 101, name: "Joes Coffee, LLC", address: "12 Elm St #4, Houston, TX 77002", phone: "(713) 555-0101", netsuiteId: "9001" }),
    dupe({ id: 102, name: "Espresso Parts Service:Black Rifle Coffee", address: "9 Oak Avenue, Austin, TX 78701", netsuiteId: "9002" }),
    dupe({ id: 103, name: "Lamar Lunch Counter", address: "77 Lamar Blvd., Austin, Texas 78704", phone: "512 555 0177", netsuiteId: "9003" }),
    dupe({ id: 104, name: "Federal Grill - Katy", address: "20 Mason Rd, Katy, TX 77450", email: "katy@federalgrill.test", netsuiteId: "9004" }),
    dupe({ id: 105, name: "Main Street Bakery", address: "400 Main Street, Suite 240, Houston, TX 77002", netsuiteId: "9005" }),
    dupe({ id: 106, name: "Sunrise Donuts", phone: "281-555-0123", email: "owner@gmail.com", netsuiteId: "9006" }),
    dupe({ id: 107, name: "Joe's Coffee Inc", netsuiteId: "9007" }),
  ];
  const added = new Set([101, 102, 103, 104, 105, 106, 107]);
  const pairs = findPossibleDuplicates(added, accounts);

  const joe = pairOf(pairs, 101, 1);
  assert.equal(joe.level, "high");
  assert.deepEqual(
    joe.reasons.map((r) => r.text),
    ["Same site address", "Same phone (ends 0101)", "Same name apart from Inc / LLC / Co / The"],
  );
  assert.deepEqual(joe.keep, { id: 1, why: "more history (12 records)" });
  assert.equal(joe.otherAdded, false);

  const rifle = pairOf(pairs, 102, 2);
  assert.equal(rifle.level, "high");
  assert.deepEqual(rifle.reasons.map((r) => r.sign), ["address", "name"]);
  assert.match(rifle.reasons[1].text, /Inc \/ LLC \/ Co \/ The and the “Espresso Parts Service:” prefix/);

  // A Walk-In is never the one to keep, whatever its history.
  const walk = pairOf(pairs, 103, 3);
  assert.equal(walk.level, "high", "same address and phone");
  assert.deepEqual(walk.keep, { id: 103, why: "the other is a Walk-In account" });

  // Another location of the same business: a similar name and the same email domain only.
  const katy = pairOf(pairs, 104, 4);
  assert.equal(katy.level, "low");
  assert.deepEqual(katy.reasons.map((r) => r.sign), ["domain", "similar"]);

  // One building, two suites.
  const suites = pairOf(pairs, 105, 5);
  assert.equal(suites.level, "low");
  assert.equal(suites.reasons[0].text, "Same street, another suite (Ste 240 · Ste 100)");

  // The same Gmail address is a sign; the same free domain alone never is.
  const tea = pairOf(pairs, 106, 6);
  assert.equal(tea.level, "medium", "same phone and same email");
  assert.deepEqual(tea.reasons.map((r) => r.sign), ["phone", "email"]);

  // A name alone is Low, and two added accounts pair up once.
  const nameOnly = pairOf(pairs, 107, 1);
  assert.equal(nameOnly.level, "low");
  assert.deepEqual(nameOnly.reasons.map((r) => r.sign), ["name"]);
  const both = pairs.filter((p) => [p.added.id, p.other.id].sort().join() === "101,107");
  assert.equal(both.length, 1);
  assert.equal(both[0].otherAdded, true);

  // Nothing pairs that has no sign, and High comes first.
  assert.equal(pairOf(pairs, 104, 1), undefined);
  assert.deepEqual([...new Set(pairs.map((p) => p.level))], ["high", "medium", "low"]);
});

test("a phone, email, domain or street on more than five accounts isn't counted; two Walk-Ins have no keep", () => {
  const hq = Array.from({ length: SHARED + 1 }, (_, i) =>
    dupe({ id: i + 1, name: `Franchise Store ${i + 1}`, phone: "800-555-0100", email: `store${i + 1}@franchise.test`, address: `${i + 1} Mall Rd, Ste ${i + 1}, Houston, TX 77002` }),
  );
  const added = dupe({ id: 50, name: "Franchise Store Uptown", phone: "800-555-0100", email: "uptown@franchise.test", address: "1 Mall Rd, Ste 99, Houston, TX 77002" });
  const pairs = findPossibleDuplicates(new Set([50]), [...hq, added]);
  for (const p of pairs) {
    assert.ok(!p.reasons.some((r) => r.sign === "phone" || r.sign === "domain"), "the head office's phone and domain say nothing");
  }
  // The street "1 Mall Rd" is on two accounts only, so a different suite there still counts (Low).
  assert.equal(pairOf(pairs, 50, 1)?.level, "low");

  const walkIns = findPossibleDuplicates(new Set([61]), [
    dupe({ id: 60, name: "Walk - In: Katy", address: "5 Main St, Katy, TX 77450" }),
    dupe({ id: 61, name: "Walk-In Katy", address: "5 Main Street, Katy, TX 77450" }),
  ]);
  assert.equal(walkIns.length, 1);
  assert.equal(walkIns[0].keep, null);
  assert.deepEqual(walkIns[0].reasons.map((r) => r.sign), ["address"], "a Walk-In name is never a name sign");
});

test("the report downloads with both names, both addresses and the reasons; phones show only their last four digits", () => {
  const pairs = findPossibleDuplicates(new Set([2]), [
    dupe({ id: 1, name: "Alpha Coffee", address: "1 Main St, Houston, TX 77002", phone: "713-555-0199", history: 2 }),
    dupe({ id: 2, name: "Alpha Coffee LLC", address: "1 Main Street, Houston, TX 77002", phone: "(713) 555-0199" }),
  ]);
  const csv = toCsv(DUPE_CSV_COLUMNS, dupeCsvRows(pairs));
  assert.match(csv, /^Rating,Added Account,Added Account ID,Added Address,Possible Duplicate,/);
  assert.match(csv, /High,Alpha Coffee LLC,2,"1 Main Street, Houston, TX 77002",Alpha Coffee,1,"1 Main St, Houston, TX 77002",,/);
  assert.match(csv, /Same phone \(ends 0199\)/);
  assert.doesNotMatch(csv, /555-0199|5550199/, "no full phone number");
  assert.match(csv, /Alpha Coffee \(more history \(2 records\)\)/);
});

// ── On a database: the NetSuite import adds accounts, then the report and the export read them ────────────────────────

const HEAD = [
  "Internal ID", "Account Number", "Company Name",
  "Billing Address 1", "Billing Address 2", "Billing City", "Billing State/Province", "Billing Zip", "Billing Country",
  "Shipping Address 1", "Shipping Address 2", "Shipping City", "Shipping State/Province", "Shipping Zip", "Shipping Country",
  "Primary Contact", "Phone", "Email", "Inactive",
];
const KEYS = ["id", "num", "name", "b1", "b2", "bcity", "bstate", "bzip", "bcountry", "s1", "s2", "scity", "sstate", "szip", "scountry", "contact", "phone", "email", "inactive"];
const nsRow = (o) => KEYS.map((k) => o[k] ?? "");
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const base64Of = (rows) => Buffer.from([HEAD, ...rows].map((r) => r.map((c) => cell(String(c))).join(",")).join("\r\n"), "utf8").toString("base64");

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

/** Every customer row and history line, to show a report or export changed nothing. */
const snapshot = async (pg) => ({
  customers: (await pg.query("select * from directory_customers order by id")).rows,
  activity: (await pg.query("select count(*)::int as n from activity")).rows[0].n,
  runs: (await pg.query("select count(*)::int as n from customer_import_runs")).rows[0].n,
});

test("a NetSuite file with an Inactive column: the flag saves, an Account Number equal to the name stays blank, and the accounts it added are the report's", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query(
      `insert into directory_customers (name, address, phone, account_number) values
         ('Joe''s Coffee', '12 Elm Street, Suite 4, Houston, TX 77002', '713-555-0101', '5521'),
         ('Quiet Tea', null, null, null)`,
    );
    await pg.query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-1', 'Joe''s Coffee', 'Completed'), ('service', 'SC-2', 'Joe''s Coffee', 'Completed')");
    const file = [
      nsRow({ id: "9001", num: "Joes Coffee, LLC", name: "Joes Coffee, LLC", s1: "12 Elm St #4", scity: "Houston", sstate: "TX", szip: "77002", phone: "(713) 555-0101", inactive: "No" }),
      nsRow({ id: "9002", num: "00077", name: "Quiet Tea", inactive: "Yes" }),
      nsRow({ id: "9003", name: "Sunrise Donuts", s1: "8 Bay St", scity: "Galveston", sstate: "TX", szip: "77550", inactive: "No" }),
      nsRow({ id: "9004", name: "Closed Corner Cafe", inactive: "Yes" }),
    ];
    const preview = await previewNetsuitePlan(sql, { filename: "customers-2026-10-23.csv", base64: base64Of(file) });
    const include = preview.lines.filter((l) => l.status === "create" || l.status === "update").map((l) => l.line);
    const rows = readNetsuiteMatrix(matrixFromBase64(base64Of(file))).rows;
    const saved = await applyNetsuitePlan(sql, { rows, include, filename: "customers-2026-10-23.csv", who: "chuy" });
    assert.deepEqual([saved.created, saved.updated], [2, 1], "Joes Coffee, LLC and Sunrise Donuts added; Quiet Tea updated");

    const quiet = (await pg.query("select inactive, account_number, netsuite_id from directory_customers where name = 'Quiet Tea'")).rows[0];
    assert.deepEqual(quiet, { inactive: true, account_number: "00077", netsuite_id: "9002" });
    const joes = (await pg.query("select id, account_number, inactive from directory_customers where name = 'Joes Coffee, LLC'")).rows[0];
    assert.equal(joes.account_number, null, "an Account Number equal to the company name is blank");
    assert.equal(joes.inactive, false);
    assert.equal((await pg.query("select count(*)::int as n from directory_customers where name = 'Closed Corner Cafe'")).rows[0].n, 0, "inactive and new: not added");

    // Another, later import adds an account too: the report keeps them apart.
    await pg.query("update customer_import_runs set created_at = now() - interval '1 hour'");
    await pg.query("update activity set created_at = created_at - interval '1 hour'");
    const later = [nsRow({ id: "9010", name: "Later Latte", s1: "1 New Rd", scity: "Houston", sstate: "TX", szip: "77003" })];
    await applyNetsuitePlan(sql, { rows: readNetsuiteMatrix(matrixFromBase64(base64Of(later))).rows, include: [2], filename: "later.csv", who: "chuy" });

    const runs = await dupeRuns(sql);
    assert.deepEqual(runs.map((r) => [r.filename, r.created]), [["later.csv", 1], ["customers-2026-10-23.csv", 2]]);
    const firstRun = runs[1];
    const addedIds = await accountsAddedByRun(sql, firstRun.id);
    const names = (await pg.query("select name from directory_customers where id = any($1::int[]) order by name", [addedIds])).rows.map((r) => r.name);
    assert.deepEqual(names, ["Joes Coffee, LLC", "Sunrise Donuts"]);

    const before = await snapshot(pg);
    const report = await possibleDuplicatesFor(sql, firstRun.id);
    assert.equal(report.run.id, firstRun.id);
    assert.equal(report.added, 2);
    assert.equal(report.pairs.length, 1);
    const [pair] = report.pairs;
    assert.equal(pair.added.name, "Joes Coffee, LLC");
    assert.equal(pair.other.name, "Joe's Coffee");
    assert.equal(pair.level, "high");
    assert.equal(pair.other.history, 2);
    assert.deepEqual(pair.keep, { id: pair.other.id, why: "more history (2 records)" });
    // With no run named, the newest is used.
    assert.equal((await possibleDuplicatesFor(sql)).run.filename, "later.csv");

    // The export, CSV and Excel.
    const accounts = await loadExportAccounts(sql);
    const csvFile = customerExportFile(accounts, "csv", "2026-10-23");
    assert.equal(csvFile.filename, "KatzDesk-Customers-2026-10-23.csv");
    const csv = Buffer.from(csvFile.base64, "base64").toString("utf8");
    assert.ok(csv.startsWith("\uFEFFKatzDesk ID,Name,NetSuite Internal ID,Account Number,"));
    assert.match(csv, /Joes Coffee, LLC/);
    const sunrise = csv.split("\r\n").find((l) => l.includes("Sunrise Donuts"));
    assert.match(sunrise, /,9003,,8 Bay St,,Galveston,TX,77550,/);
    assert.match(sunrise, /NetSuite import \d{4}-\d{2}-\d{2}, by chuy/);
    assert.match(csv.split("\r\n").find((l) => l.includes("Quiet Tea")), /,9002,00077,/);

    const xlsx = customerExportFile(accounts, "xlsx", "2026-10-23");
    const sheet = XLSX.read(Buffer.from(xlsx.base64, "base64"), { type: "buffer" }).Sheets.Customers;
    const head = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
    assert.deepEqual(head, [...CUSTOMER_EXPORT_COLUMNS]);
    const quietRow = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }).findIndex((r) => r[1] === "Quiet Tea");
    const numberCell = sheet[XLSX.utils.encode_cell({ r: quietRow, c: col("Account Number") })];
    assert.equal(numberCell.t, "s", "a text cell");
    assert.equal(numberCell.v, "00077");
    assert.equal(xlsx.rows, 5);

    // Nothing was changed by the report or the export.
    assert.deepEqual(await snapshot(pg), before);
  } finally {
    await pg.close();
  }
});

test("removed accounts are in the export and marked; a removed account is never a possible duplicate", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("insert into directory_customers (name, address, archived) values ('Old Alpha', '1 Main St, Houston, TX 77002', true)");
    const file = [nsRow({ id: "1", name: "Alpha Coffee", s1: "1 Main Street", scity: "Houston", sstate: "TX", szip: "77002" })];
    await applyNetsuitePlan(sql, { rows: readNetsuiteMatrix(matrixFromBase64(base64Of(file))).rows, include: [2], filename: "a.csv", who: "chuy" });
    const report = await possibleDuplicatesFor(sql);
    assert.equal(report.added, 1);
    assert.deepEqual(report.pairs, [], "Old Alpha is removed");
    const csv = Buffer.from(customerExportFile(await loadExportAccounts(sql), "csv", "2026-10-23").base64, "base64").toString("utf8");
    const old = csv.split("\r\n").find((l) => l.includes("Old Alpha"));
    assert.ok(old.endsWith(",Not recorded,,,Yes,"), old);
  } finally {
    await pg.close();
  }
});

test("before any NetSuite import, the report says so and the export still works", async () => {
  const { pg, sql } = await fresh();
  try {
    const report = await possibleDuplicatesFor(sql);
    assert.equal(report.run, null);
    assert.deepEqual(report.pairs, []);
    assert.equal(customerExportFile(await loadExportAccounts(sql), "csv", "2026-10-23").rows, 0);
  } finally {
    await pg.close();
  }
});
