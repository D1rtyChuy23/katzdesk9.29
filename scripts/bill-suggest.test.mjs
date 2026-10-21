import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
const { suggestBill, sourceKeyTaken } = await import("../src/lib/ops/pm-bill.ts");

const lm = {
  sku: "LMF.3.040",
  name: "PARTS : LMF.3.040",
  description: "Group gasket",
  mfrPart: null,
  rate: 18,
  active: true,
  hidden: false,
};

function machine(over = {}) {
  return {
    label: "Linea PB",
    serial: "123",
    machineKey: "acct:9",
    accountId: 9,
    serialKey: "123",
    manufacturer: "La Marzocco",
    kits: [
      { ev: "F.3.040", name: "Group gasket", q: 2 },
      { ev: "EVSKIP", name: "Not ticked", q: 1 },
      { ev: "ADDED1", name: "Added kit", q: 1 },
    ],
    ticks: ["kit:F.3.040", "kit:ADDED1"],
    catalog: [lm, { sku: "ADDED1", name: "PARTS : ADDED1", description: "Added kit", mfrPart: null, rate: 4, active: true, hidden: false }],
    parts: [],
    ...over,
  };
}

const linesOf = (pms, onBill = []) => suggestBill(pms, onBill).groups.flatMap((g) => g.lines);

test("only ticked kits are suggested, including a ticked added kit, priced with the LM prefix", () => {
  const lines = linesOf([{ id: 4, status: "Completed", machines: [machine()] }]);
  assert.deepEqual(lines.map((l) => l.item), ["PARTS : LMF.3.040", "PARTS : ADDED1"]);
  assert.equal(lines[0].qty, 2);
  assert.equal(lines[0].rate, 18);
  assert.equal(lines[0].reason, null);
  assert.equal(lines[0].sourceKey, "pmkit:4:acct:9:F.3.040");
  assert.equal(lines[0].description, "Group gasket — Linea PB SN 123 (PM #4)");
  assert.equal(lines[1].sourceKey, "pmkit:4:acct:9:ADDED1");
});

test("no-price, inactive and missing kits carry a reason and are not priced", () => {
  const lines = linesOf([
    {
      id: 32,
      status: "Open",
      machines: [
        machine({
          manufacturer: null,
          kits: [
            { ev: "NOPRICE", name: "No price", q: 1 },
            { ev: "HIDDEN", name: "Hidden kit", q: 1 },
            { ev: "GONE", name: "Missing kit", q: 1 },
          ],
          ticks: ["kit:NOPRICE", "kit:HIDDEN", "kit:GONE"],
          catalog: [
            { sku: "NOPRICE", name: "PARTS : NOPRICE", description: "No price", mfrPart: null, rate: null, active: true, hidden: false },
            { sku: "HIDDEN", name: "PARTS : HIDDEN", description: "Hidden kit", mfrPart: null, rate: 9, active: false, hidden: true },
          ],
        }),
      ],
    },
  ]);
  assert.deepEqual(lines.map((l) => [l.item, l.reason, l.rate]), [
    ["PARTS : NOPRICE", "No sell price in the catalog", 0],
    ["PARTS : HIDDEN", "Inactive or hidden in the catalog", 0],
    ["Missing kit", "Not in parts catalog", 0],
  ]);
  assert.equal(lines.every((l) => l.reason), true);
});

test("a billable part uses the current rate and a no-charge part is left off", () => {
  const lines = linesOf([
    {
      id: 32,
      status: "Open",
      machines: [
        machine({
          kits: [],
          ticks: [],
          catalog: [],
          parts: [
            { id: 7, item: "PARTS : OLD", description: "Burr set", qty: 2, billable: true, billingItemId: 70, active: true, hidden: false, rate: 22, currentItem: "PARTS : EVER104120", part: { id: 70, sku: "EVER104120", mpn: null, hasImage: false, imageVersion: null } },
            { id: 8, item: "PARTS : FREE", description: "Gasket", qty: 1, billable: false, billingItemId: 71, active: true, hidden: false, rate: 5, currentItem: "PARTS : FREE", part: null },
          ],
        }),
      ],
    },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].item, "PARTS : EVER104120");
  assert.equal(lines[0].rate, 22);
  assert.equal(lines[0].qty, 2);
  assert.equal(lines[0].sourceKey, "mp:7");
  assert.equal(lines[0].reason, null);
  assert.equal(lines[0].description, "Burr set — Linea PB SN 123 (PM #32)");
});

test("a kit key counts as already on the bill under either machine key", () => {
  const onPiece = linesOf([{ id: 32, status: "Open", machines: [machine({ kits: [{ ev: "F.3.040", name: "Group gasket", q: 1 }], ticks: ["kit:F.3.040"], catalog: [lm] })] }], ["pmkit:32:piece:linea pb#1:F.3.040"]);
  assert.equal(onPiece[0].sourceKey, "pmkit:32:acct:9:F.3.040");
  assert.equal(onPiece[0].alreadyOn, true);
  const onAcct = linesOf([{ id: 32, status: "Open", machines: [machine({ machineKey: "piece:linea pb#1", accountId: null, serialKey: null, serial: null, kits: [{ ev: "F.3.040", name: "Group gasket", q: 1 }], ticks: ["kit:F.3.040"], catalog: [lm] })] }], ["pmkit:32:acct:9:F.3.040"]);
  assert.equal(onAcct[0].alreadyOn, true);
  assert.equal(sourceKeyTaken(["mp:7"], "mp:8"), false);
  assert.equal(sourceKeyTaken(["pmkit:3:acct:1:F.3.040"], "pmkit:32:acct:9:F.3.040"), false);
});

test("the second PM's repeated kit on the same unit is unchecked, and an unmatched line is not", () => {
  const shared = machine({ kits: [{ ev: "F.3.040", name: "Group gasket", q: 1 }], ticks: ["kit:F.3.040"], catalog: [lm] });
  const lines = linesOf([
    { id: 33, status: "Completed", machines: [shared] },
    { id: 32, status: "Open", machines: [{ ...shared }] },
  ]);
  assert.equal(lines[0].reason, null);
  assert.equal(lines[1].reason, "Also on PM #33 for this machine.");
  const loose = machine({
    machineKey: "piece:linea pb#1",
    accountId: null,
    serialKey: null,
    serial: null,
    kits: [{ ev: "F.3.040", name: "Group gasket", q: 1 }],
    ticks: ["kit:F.3.040"],
    catalog: [lm],
  });
  const both = linesOf([
    { id: 33, status: "Completed", machines: [loose] },
    { id: 32, status: "Open", machines: [{ ...loose, machineKey: "piece:linea pb#2" }] },
  ]);
  assert.equal(both[0].reason, null);
  assert.equal(both[1].reason, null);
});

test("a cancelled PM gives no lines, descriptions stop at 500 characters, and the list stops at 200", () => {
  const cancelled = suggestBill(
    [{ id: 32, status: "Cancelled", machines: [machine()] }],
    [],
  );
  assert.equal(cancelled.groups[0].note, "PM #32 is cancelled.");
  assert.equal(cancelled.groups.flatMap((g) => g.lines).length, 0);

  const longName = "Gasket ".repeat(80);
  const long = linesOf([
    {
      id: 4,
      status: "Open",
      machines: [machine({ kits: [{ ev: "F.3.040", name: longName, q: 1 }], ticks: ["kit:F.3.040"], catalog: [{ ...lm, description: longName }] })],
    },
  ]);
  assert.equal(long[0].description.length, 500);

  const parts = Array.from({ length: 201 }, (_, i) => ({
    id: i + 1,
    item: `PARTS : P${i}`,
    description: "Seal",
    qty: 1,
    billable: true,
    billingItemId: i + 1,
    active: true,
    hidden: false,
    rate: 3,
    currentItem: `PARTS : P${i}`,
    part: null,
  }));
  const many = linesOf([{ id: 4, status: "Open", machines: [machine({ kits: [], ticks: [], catalog: [], parts })] }]);
  assert.equal(many.length, 200);
  assert.equal(many[0].sourceKey, "mp:1");
  assert.equal(many[199].sourceKey, "mp:200");
});
