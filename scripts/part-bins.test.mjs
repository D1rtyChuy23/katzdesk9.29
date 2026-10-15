import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BIN_MAX,
  binRowsFromSheets,
  binTemplateCsv,
  binText,
  binsToApply,
  cleanBinValue,
  looksLikeExcelDate,
  planBins,
  splitBinCode,
} from "../src/lib/ops/part-bins.ts";

const part = (id, sku, mpn, bins = {}) => ({ id, sku, mpn, description: `Part ${id}`, rack: null, shelf: null, bin: null, ...bins });

const stored = [
  part(1, "EVER104120", "104120", { rack: "A", shelf: "3", bin: "12" }),
  part(2, "EVER2000", "2000-A"),
  part(3, "DUP1", "X-9"),
  part(4, "DUP2", "x9"),
  part(5, "NOMPN-7", null),
  part(6, "WF300-05802", "WF300-05802"),
];

const sheet = (matrix, name = "Sheet1") => [{ name, matrix }];

/** A CSV read back the way the import reads one: as rows of cells. */
const csvMatrix = (csv) =>
  csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split("\r\n")
    .map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).filter((c) => c !== "").map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));

test("header detection: Part #, MPN, Mfr Part, Name, SKU and Item are part numbers; the header can sit below a title row", () => {
  for (const id of ["Part #", "MPN", "Mfr Part", "Name", "SKU", "Item", "Mfr Part Number", "NetSuite Item"]) {
    const r = binRowsFromSheets(sheet([[`${id}`, "Rack", "Shelf", "Bin"], ["104120", "B", "1", "4"]]));
    assert.equal(r.rows.length, 1, id);
  }
  const titled = binRowsFromSheets(sheet([["Stockroom bins, Oct 2026"], [], ["SKU", "Bin Location"], ["EVER2000", "C-1-2"]]));
  assert.equal(titled.rows.length, 1);
  assert.deepEqual([titled.rows[0].rack, titled.rows[0].shelf, titled.rows[0].bin, titled.rows[0].line], ["C", "1", "2", 4]);
  assert.throws(() => binRowsFromSheets(sheet([["MPN", "Price"], ["104120", "3"]])), /part number column and a bin column/);
  assert.throws(() => binRowsFromSheets(sheet([["Rack", "Shelf"], ["A", "1"]])), /part number column/);
});

test("columns: MPN and SKU columns are both kept; a NetSuite Name with its parent is read as the SKU", () => {
  const r = binRowsFromSheets(sheet([["Name", "MPN", "Rack"], ["PARTS : EVER2000", "2000-A", "R2"], ["", "", "R9"], ["", "", ""]]));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].sku, "EVER2000");
  assert.equal(r.rows[0].mpn, "2000-A");
  assert.equal(r.skipped, 1, "a row with bins and no part number is counted, not read");
});

test("splitting codes: A-03-12 and A/3/12 split into rack, shelf and bin; anything else is the whole bin", () => {
  assert.deepEqual(splitBinCode("A-03-12"), { rack: "A", shelf: "03", bin: "12" });
  assert.deepEqual(splitBinCode(" A / 3 / 12 "), { rack: "A", shelf: "3", bin: "12" });
  assert.deepEqual(splitBinCode("B-2-7"), { rack: "B", shelf: "2", bin: "7" });
  assert.equal(splitBinCode("A-03"), null);
  assert.equal(splitBinCode("TOP SHELF"), null);
  assert.equal(splitBinCode("A-03-12-4"), null);
  assert.equal(splitBinCode("A--3"), null);

  const r = binRowsFromSheets(sheet([
    ["MPN", "Bin Number"],
    ["104120", "A-03-12"],
    ["2000-A", "Overflow cage"],
    ["WF300-05802", "A/3/12"],
  ]));
  assert.deepEqual(r.rows.map((x) => [x.rack, x.shelf, x.bin, x.split]), [
    ["A", "03", "12", true],
    [null, null, "Overflow cage", false],
    ["A", "3", "12", true],
  ]);
});

test("a sheet with Rack or Shelf columns (the template) is read piece by piece: its Bin column is never split", () => {
  const r = binRowsFromSheets(sheet([
    ["MPN", "SKU", "Description", "Rack", "Shelf", "Bin"],
    ["2000-A", "EVER2000", "Valve", "", "", "B-2-7"],
    ["104120", "EVER104120", "Gasket", "D", "", "4-5-6"],
  ]));
  assert.deepEqual([r.rows[0].rack, r.rows[0].shelf, r.rows[0].bin, r.rows[0].split, r.rows[0].whole], [null, null, "B-2-7", false, false]);
  assert.deepEqual([r.rows[1].rack, r.rows[1].shelf, r.rows[1].bin], ["D", null, "4-5-6"], "with a Rack, Bin is the bin piece as typed");
  // A lone Bin column (no Rack, no Shelf) is the whole location, like Bin Location.
  const lone = binRowsFromSheets(sheet([["MPN", "Bin"], ["2000-A", "B-2-7"]]));
  assert.deepEqual([lone.rows[0].rack, lone.rows[0].shelf, lone.rows[0].bin, lone.rows[0].split, lone.rows[0].whole], ["B", "2", "7", true, true]);
});

test("the Bin Template of a bin typed whole as A-03-12 imports back unchanged as No Change", () => {
  const typed = [part(1, "EVER104120", "104120", { bin: cleanBinValue("A-03-12") }), part(2, "PL", "PL-1", { bin: "PL-10-2" })];
  const read = binRowsFromSheets(sheet(csvMatrix(binTemplateCsv(typed))));
  assert.deepEqual(read.rows.map((x) => [x.rack, x.shelf, x.bin]), [[null, null, "A-03-12"], [null, null, "PL-10-2"]]);
  assert.deepEqual(planBins(read.rows, typed).map((l) => l.status), ["same", "same"]);
  // The same code in a Bin Location column is the same place too: split, but No Change against the whole stored bin.
  const code = planBins(binRowsFromSheets(sheet([["MPN", "Bin Location"], ["104120", "A-03-12"]])).rows, typed);
  assert.equal(code[0].status, "same");
  assert.deepEqual(code[0].next, { rack: null, shelf: null, bin: "A-03-12" });
  assert.equal(binsToApply(code).length, 0);
});

test("the whole-location column replaces all three pieces: a value that is not a code clears the stored Rack and Shelf", () => {
  const at = { rack: "A", shelf: "3", bin: "12" };
  const parts = [part(1, "E1", "M1", at), part(2, "E2", "M2", at), part(3, "E3", "M3", at), part(4, "E4", "M4", at)];
  const plan = planBins(binRowsFromSheets(sheet([["MPN", "Bin Location"], ["M1", "Overflow cage"], ["M2", "C-1"], ["M3", "C-1-2"], ["M4", ""]])).rows, parts);
  assert.deepEqual(plan.map((l) => [l.status, l.next]), [
    ["update", { rack: null, shelf: null, bin: "Overflow cage" }],
    ["update", { rack: null, shelf: null, bin: "C-1" }],
    ["update", { rack: "C", shelf: "1", bin: "2" }],
    ["blank", null],
  ]);
  assert.deepEqual(binsToApply(plan).map((l) => [l.partId, l.whole, l.file]), [
    [1, true, { rack: null, shelf: null, bin: "Overflow cage" }],
    [2, true, { rack: null, shelf: null, bin: "C-1" }],
    [3, true, { rack: "C", shelf: "1", bin: "2" }],
  ]);
  // Rack, Shelf and Bin columns still keep a stored piece for a blank cell.
  const pieces = planBins(binRowsFromSheets(sheet([["MPN", "Rack", "Shelf", "Bin"], ["M1", "", "", "Overflow cage"]])).rows, parts);
  assert.deepEqual([pieces[0].whole, pieces[0].next], [false, { rack: "A", shelf: "3", bin: "Overflow cage" }]);
});

test("a bin Excel turned into a date is flagged, never split and never applied", () => {
  for (const s of ["1/2/2007", "1/2/07", "12/31/2026", "2-Jan", "12-Mar-07", "Mar-07"]) assert.equal(looksLikeExcelDate(s), true, s);
  for (const s of ["A-03-12", "A/3/12", "1-2-7", "4318-100-01", "Top Shelf", "12", "B-Jan", "13/2"]) assert.equal(looksLikeExcelDate(s), false, s);
  const parts = [part(1, "E1", "M1"), part(2, "E2", "M2", { bin: "1-2-7" }), part(3, "E3", "M3"), part(4, "E4", "M4")];
  const read = binRowsFromSheets(sheet([["MPN", "Bin Location"], ["M1", "1/2/2007"], ["M2", "1/2/07"], ["M3", "2-Jan"], ["M1", "A-1-2"]]));
  assert.deepEqual(read.rows.map((x) => [x.split, x.date]), [[false, "1/2/2007"], [false, "1/2/07"], [false, "2-Jan"], [true, null]]);
  const plan = planBins(read.rows, parts);
  assert.deepEqual(plan.map((l) => l.status), ["date", "date", "date", "update"], "a later good row for the same part is used");
  assert.match(plan[0].reason, /1\/2\/2007 looks like a date/);
  assert.deepEqual(binsToApply(plan).map((l) => l.partId), [1]);
  // In the template's Rack, Shelf and Bin columns too.
  const tpl = planBins(binRowsFromSheets(sheet([["MPN", "Rack", "Shelf", "Bin"], ["M4", "", "", "1/2/2007"]])).rows, parts);
  assert.equal(tpl[0].status, "date");
});

test("a SKU or Name column with no exact SKU is matched like the parts import: a number two parts carry is Ambiguous", () => {
  // Part 1's SKU is 104-120 (no MPN); part 2's MPN is 104120.
  const a = [part(1, "104-120", null), part(2, "EVER104120", "104120")];
  for (const col of ["SKU", "Name", "MPN"]) {
    const plan = planBins(binRowsFromSheets(sheet([[col, "Bin"], ["104120", "7"]])).rows, a);
    assert.equal(plan[0].status, "ambiguous", col);
  }
  // Part 3's SKU is AB-12 but its MPN is QQQ; part 4's MPN is AB12. Name AB12 is part 4, as the parts import says.
  const b = [part(3, "AB-12", "QQQ"), part(4, "EVER77", "AB12")];
  const plan = planBins(binRowsFromSheets(sheet([["Name", "Bin"], ["AB12", "7"]])).rows, b);
  assert.deepEqual([plan[0].status, plan[0].partId], ["update", 4]);
  // An exact SKU still picks its part.
  assert.equal(planBins(binRowsFromSheets(sheet([["SKU", "Bin"], ["AB-12", "7"]])).rows, b)[0].partId, 3);
});

test("normalization: values trimmed and spaces collapsed, blank is null; MPN match ignores case, spaces and punctuation", () => {
  assert.equal(cleanBinValue("  Top   Shelf "), "Top Shelf");
  assert.equal(cleanBinValue("   "), null);
  assert.equal(cleanBinValue(null), null);
  assert.equal(cleanBinValue("'=A1"), "=A1", "the spreadsheet guard apostrophe comes off");
  assert.equal(cleanBinValue("O'Neil"), "O'Neil");
  const plan = planBins(binRowsFromSheets(sheet([["Mfr Part", "Rack"], [" 2000 a ", "R1"], ["ever104120", "Z"]])).rows, stored);
  assert.equal(plan[0].status, "update");
  assert.equal(plan[0].partId, 2);
  assert.equal(plan[1].partId, null, "an MPN column does not match another part's SKU when that part has an MPN");
  assert.equal(plan[1].status, "unmatched");
  const bySku = planBins(binRowsFromSheets(sheet([["SKU", "Rack"], ["ever104120", "Z"], ["nompn 7", "Q"], ["NOMPN-7", "Q"]])).rows, stored);
  assert.deepEqual(bySku.map((l) => [l.status, l.partId]), [["update", 1], ["update", 5], ["duplicate", 5]]);
  // A part with no MPN is found by its SKU from the MPN column too (as the parts import does).
  assert.equal(planBins(binRowsFromSheets(sheet([["MPN", "Bin"], ["nompn7", "9"]])).rows, stored)[0].partId, 5);
});

test("blank cells keep what is stored; a row with no bin values is Blank; unchanged is No Change", () => {
  const plan = planBins(binRowsFromSheets(sheet([
    ["MPN", "Rack", "Shelf", "Bin"],
    ["104120", "", "", "14"],
    ["2000-A", "", "", ""],
    ["WF300-05802", "F", "1", "1"],
  ])).rows, stored);
  assert.equal(plan[0].status, "update");
  assert.deepEqual(plan[0].old, { rack: "A", shelf: "3", bin: "12" });
  assert.deepEqual(plan[0].next, { rack: "A", shelf: "3", bin: "14" });
  assert.deepEqual(plan[0].file, { rack: null, shelf: null, bin: "14" }, "the write gets nulls for blank cells, so stored pieces stay");
  assert.equal(plan[1].status, "blank");
  assert.equal(plan[2].status, "update");
  const again = planBins(binRowsFromSheets(sheet([["MPN", "Rack", "Shelf", "Bin"], ["104120", "A", "", "12"], ["104120", "A", "3", "12"]])).rows, stored);
  assert.equal(again[0].status, "same");
  assert.equal(again[1].status, "duplicate");
  assert.deepEqual(binsToApply(plan).map((l) => l.partId), [1, 6]);
});

test("ambiguity: a part number two parts share, or an MPN and a SKU that point at different parts", () => {
  const plan = planBins(binRowsFromSheets(sheet([
    ["MPN", "SKU", "Bin"],
    ["X9", "", "1"],
    ["X9", "DUP2", "2"],
    ["104120", "EVER2000", "3"],
    ["", "WF300-05802", "4"],
  ])).rows, stored);
  assert.equal(plan[0].status, "ambiguous");
  assert.match(plan[0].reason, /Matches 2 parts \(DUP1, DUP2\)/);
  assert.equal(plan[1].status, "update", "the SKU picks one of the parts sharing the MPN");
  assert.equal(plan[1].partId, 4);
  assert.equal(plan[2].status, "ambiguous", "MPN of one part and SKU of another");
  assert.equal(plan[3].partId, 6);
  assert.equal(binsToApply(plan).length, 2);
});

test("too long pieces are not applied", () => {
  const long = "X".repeat(BIN_MAX + 1);
  const plan = planBins(binRowsFromSheets(sheet([["MPN", "Shelf"], ["2000-A", long], ["2000-A", "OK"]])).rows, stored);
  assert.equal(plan[0].status, "too_long");
  assert.match(plan[0].reason, /Shelf is longer than 40/);
  assert.equal(plan[1].status, "update", "a later valid row for the same part is used");
});

test("bin text and the template round trip", () => {
  assert.equal(binText({ rack: "A", shelf: "3", bin: "12" }), "Rack A · Shelf 3 · Bin 12");
  assert.equal(binText({ rack: null, shelf: null, bin: "7" }), "Bin 7");
  assert.equal(binText({ rack: null, shelf: null, bin: null }), null);
  const csv = binTemplateCsv([stored[0], { ...stored[1], description: 'Valve, "big"', bin: "=SUM(A1)" }]);
  assert.ok(csv.startsWith("\uFEFFMPN,SKU,Description,Rack,Shelf,Bin\r\n"));
  assert.ok(csv.includes('"Valve, ""big"""'));
  assert.ok(csv.includes("'=SUM(A1)"), "formula-looking cells are guarded");
  const read = binRowsFromSheets(sheet(csvMatrix(csv)));
  assert.equal(read.rows[1].bin, "=SUM(A1)");
  const plan = planBins(read.rows, [stored[0], { ...stored[1], bin: "=SUM(A1)" }]);
  assert.deepEqual(plan.map((l) => l.status), ["same", "same"]);
});
