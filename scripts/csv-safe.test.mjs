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
});

test("every CSV writer uses the one rule", async () => {
  const { csvCell: customer } = await import("../src/lib/ops/customer-export.ts");
  const { csvCell: charges } = await import("../src/lib/ops/charges.ts");
  for (const f of [customer, charges]) {
    assert.equal(f("-2+HYPERLINK(1)"), "'-2+HYPERLINK(1)");
    assert.equal(f("\t=1"), "'\t=1");
    assert.equal(f(-40), "-40", "a credit stays a number");
  }
  const { reviewCsv } = await import("../src/lib/ops/customer-geocode.ts");
  const { readFileSync } = await import("node:fs");
  // The rest call it inside; check the source uses it rather than its own escaper.
  for (const [file, name] of [
    ["netsuite-customers.ts", "safeCsvCell"],
    ["library-import.ts", "safeCsvCell"],
    ["export-reports.ts", "safeCsvCell"],
    ["pm-runbook-readiness.ts", "spreadsheetText"],
    ["customer-geocode.ts", "safeCsvCell"],
  ]) {
    const src = readFileSync(new URL(`../src/lib/ops/${file}`, import.meta.url), "utf8");
    assert.match(src, new RegExp(`import \\{ ${name} \\} from "(\\./|@/lib/ops/)csv-safe`), file);
  }
  const { readinessCsv } = await import("../src/lib/ops/pm-runbook-readiness.ts");
  const gaps = readinessCsv([
    { pmId: 7, customer: "-2+HYPERLINK(1)", status: "Open", piece: "=cmd", runbookId: "x", accountId: null, serial: null, installDate: null, gaps: ["no-serial"] },
  ]);
  assert.match(gaps.split("\n")[1], /^"7","'-2\+HYPERLINK\(1\)","Open","'=cmd",/, "readiness CSV: every cell still quoted, formulas kept as text");
  assert.equal(typeof reviewCsv, "function");
});
