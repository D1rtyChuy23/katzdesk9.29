// One formula guard for every CSV the desk writes (11/26). Values here are made up.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { spreadsheetText, safeCsvCell } = await import("../src/lib/ops/csv-safe.ts");

test("text a spreadsheet would run as a formula gets an apostrophe; numbers and plain text do not", () => {
  for (const bad of ["=1+1", "+1 713 555 0101", "@SUM(A1)", "-2+HYPERLINK(\"http://x\")", "-A1", "-$12.00", "\t=1+1", "\r=1+1", "-1e3"]) {
    assert.equal(spreadsheetText(bad), `'${bad}`, JSON.stringify(bad));
  }
  for (const ok of ["", "-", "-12", "-12.5", "-0.75", "12", "Katz Coffee", "3-Group Espresso", " =padded", "'already"]) {
    assert.equal(spreadsheetText(ok), ok, JSON.stringify(ok));
  }
});

test("a CSV cell: guarded, then quoted when it holds a quote, comma or line break", () => {
  assert.equal(safeCsvCell(null), "");
  assert.equal(safeCsvCell(undefined), "");
  assert.equal(safeCsvCell(-12.5), "-12.5");
  assert.equal(safeCsvCell(42), "42");
  assert.equal(safeCsvCell("Smith, John"), '"Smith, John"');
  assert.equal(safeCsvCell('6" hose'), '"6"" hose"');
  assert.equal(safeCsvCell("line\r\nbreak"), '"line\r\nbreak"');
  assert.equal(safeCsvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`);
  assert.equal(safeCsvCell("\r=1"), `"'\r=1"`, "a leading return is guarded and quoted");
  assert.equal(safeCsvCell(-1e-7), "-1e-7", "a real number stays a number, however it prints");
  assert.equal(safeCsvCell(-1e21), "-1e+21");
  assert.equal(safeCsvCell(-Infinity), "");
  assert.equal(safeCsvCell(Number.NaN), "");
});

test("every CSV writer uses the one rule", async () => {
  const { csvCell: customer } = await import("../src/lib/ops/customer-export.ts");
  const { csvCell: charges } = await import("../src/lib/ops/charges.ts");
  for (const f of [customer, charges]) {
    assert.equal(f("-2+HYPERLINK(1)"), "'-2+HYPERLINK(1)");
    assert.equal(f("\t=1"), "'\t=1");
    assert.equal(f(-40), "-40", "a credit stays a number");
  }
  // The Library import log and Export Reports need a database to run: check that their writers use the rule.
  const { readFileSync } = await import("node:fs");
  for (const [file, uses] of [
    ["library-import.ts", /const csvCell = safeCsvCell;/],
    ["export-reports.ts", /const esc = \(v: string\) => safeCsvCell\(v\);/],
  ]) {
    const src = readFileSync(new URL(`../src/lib/ops/${file}`, import.meta.url), "utf8");
    assert.match(src, uses, file);
    assert.doesNotMatch(src, /replace\(\/"\/g, '""'\)/, `${file} has no escaper of its own left`);
  }
  const { readinessCsv } = await import("../src/lib/ops/pm-runbook-readiness.ts");
  const gaps = readinessCsv([
    { pmId: 7, customer: "-2+HYPERLINK(1)", status: "Open", piece: "=cmd", runbookId: "x", accountId: null, serial: null, installDate: null, gaps: ["no-serial"] },
  ]);
  assert.match(gaps.split("\n")[1], /^"7","'-2\+HYPERLINK\(1\)","Open","'=cmd",/, "readiness CSV: every cell still quoted, formulas kept as text");

  const { netsuitePreviewCsv } = await import("../src/lib/ops/netsuite-customers.ts");
  const ns = netsuitePreviewCsv(
    [{ status: "create", line: 2, internalId: "@123", accountNumber: "-2+1", companyName: "=cmd|' /C calc'!A0", accountName: null, matchedBy: null, changes: [], reason: "", notes: [] }],
    new Set([2]),
  );
  const nsRow = ns.replace(/^\uFEFF/, "").split(/\r?\n/)[1];
  assert.ok(nsRow.includes(",'@123,'-2+1,'=cmd|' /C calc'!A0,"), nsRow);

  const { reviewCsv } = await import("../src/lib/ops/customer-geocode.ts");
  const geo = reviewCsv([
    { review: true, status: "unmatched", line: 4, name: "+Tea Bar", account: "", internalId: "", accountName: null, matchedBy: null, address: "\t=1+1", result: "", matchedAddress: "", latitude: 29.76, longitude: -95.37, reviewReason: "-check" },
  ]);
  const geoRow = geo.replace(/^\uFEFF/, "").split("\r\n")[1];
  assert.ok(geoRow.startsWith("4,'+Tea Bar,"), geoRow);
  assert.ok(geoRow.includes(",'\t=1+1,"), "a tab then = stays text");
  assert.ok(geoRow.includes(",29.76,-95.37,No,'-check"), "a negative longitude stays a number");
});

test("the parts bin template reads back what it wrote", async () => {
  const { csvCell } = await import("../src/lib/ops/charges.ts");
  const { cleanBinValue } = await import("../src/lib/ops/part-bins.ts");
  for (const v of ["-A1", "=1", "+3", "@x", "-12", "-", "A-3", "Shelf 2"]) {
    const cell = csvCell(v);
    const unquoted = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
    assert.equal(cleanBinValue(unquoted), v, `${v} → ${cell}`);
  }
});
