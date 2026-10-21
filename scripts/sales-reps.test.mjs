import assert from "node:assert/strict";
import { test } from "node:test";
import { countSalesReps, planSalesReps, salesRepFilesFromMatrix } from "../src/lib/ops/sales-reps.ts";

const known = [
  { name: "Amanda Logg", userId: "u-al" },
  { name: "Sean Marshall", userId: "u-sm" },
  { name: "Lizbeth Romero", userId: null },
];

const accounts = [
  { id: 1, name: "Woody's Smokehouse", netsuiteId: "158", accountNumber: "100", accountRep: null },
  { id: 2, name: "Doug's Diner", netsuiteId: "200", accountNumber: "200", accountRep: "Lizbeth Romero" },
  { id: 3, name: "Cafe Luna", netsuiteId: null, accountNumber: null, accountRep: "Amanda Logg" },
  { id: 4, name: "Cafe Luna", netsuiteId: null, accountNumber: null, accountRep: null },
];

test("one row per rep is one account, matched by Internal ID before account number", () => {
  const files = salesRepFilesFromMatrix([
    ["Internal ID", "Account Number", "Customer Name", "Primary Sales Rep", "Sales Rep", "Role", "Contribution %", "Primary"],
    ["158", "999", "Wrong Name", "AL", "Amanda Logg", "Primary", "60%", "Yes"],
    ["158", "999", "Wrong Name", "AL", "Sean Marshall", "Secondary", "40", "No"],
  ]);
  assert.equal(files.length, 1);
  assert.equal(files[0].reps.length, 2);
  assert.equal(files[0].reps[0].pct, 60);
  assert.equal(files[0].reps[0].primary, true);
  const [line] = planSalesReps(files, accounts, known, []);
  assert.equal(line.status, "update");
  assert.equal(line.matchedBy, "internal ID");
  assert.equal(line.accountId, 1);
  assert.equal(line.primaryChange, true);
  assert.equal(line.currentPrimary, null);
  assert.equal(line.nextPrimary, "Amanda Logg");
  assert.equal(line.willSave, true);
  assert.equal(line.reps[0].userId, "u-al");
});

test("account number, then exact name; a different spelling is unmatched", () => {
  const byNumber = salesRepFilesFromMatrix([
    ["Account Number", "Customer Name", "Primary Sales Rep"],
    ["200", "Not Doug", "Sean Marshall"],
  ]);
  const n = planSalesReps(byNumber, accounts, known, [])[0];
  assert.equal(n.matchedBy, "account number");
  assert.equal(n.accountId, 2);
  assert.equal(n.primaryChange, true);
  assert.match(n.reason, /Lizbeth Romero → Sean Marshall/);

  const byName = salesRepFilesFromMatrix([
    ["Customer Name", "Primary Sales Rep", "Sales Rep", "Role"],
    ["Doug's Diner", "Lizbeth Romero", "Lizbeth Romero", "Primary"],
  ]);
  const same = planSalesReps(byName, accounts, known, [
    { customerId: 2, reps: [{ name: "Lizbeth Romero", role: "Primary", pct: null, primary: true }] },
  ])[0];
  assert.equal(same.matchedBy, "name");
  assert.equal(same.status, "same");
  assert.equal(same.willSave, false);

  const miss = planSalesReps(
    salesRepFilesFromMatrix([
      ["Customer Name", "Primary Sales Rep"],
      ["Dougs Diner", "Lizbeth Romero"],
    ]),
    accounts,
    known,
    [],
  )[0];
  assert.equal(miss.status, "unmatched");
});

test("two accounts with the same exact name are not guessed", () => {
  const line = planSalesReps(
    salesRepFilesFromMatrix([
      ["Customer Name", "Primary Sales Rep"],
      ["Cafe Luna", "Amanda Logg"],
    ]),
    accounts,
    known,
    [],
  )[0];
  assert.equal(line.status, "unmatched");
  assert.match(line.reason, /More than one/);
});

test("an unknown rep is listed and does not become the primary or a user", () => {
  const line = planSalesReps(
    salesRepFilesFromMatrix([
      ["Internal ID", "Customer Name", "Primary Sales Rep", "Sales Rep", "Role", "Contribution %", "Primary"],
      ["158", "Woody's Smokehouse", "Pat Someone", "Pat Someone", "Sales", "100%", "Yes"],
      ["158", "Woody's Smokehouse", "Pat Someone", "Amanda Logg", "Overlay", "0", "No"],
    ]),
    accounts,
    known,
    [],
  )[0];
  assert.equal(line.status, "unknown");
  assert.equal(line.primaryChange, false);
  assert.equal(line.nextPrimary, null);
  assert.deepEqual(line.unknownReps, ["Pat Someone"]);
  assert.equal(line.reps.find((r) => r.storedName === "Pat Someone").userId, null);
  assert.equal(line.willSave, true);
  const counts = countSalesReps([line]);
  assert.equal(counts.unknown, 1);
  assert.equal(counts.update, 0);
});

test("reps across the row are read, and a matching primary is not saved again", () => {
  const files = salesRepFilesFromMatrix([
    ["Internal ID", "Customer Name", "Primary Sales Rep", "Sales Rep", "Role", "%", "Primary", "Sales Rep 2", "Role 2", "% 2", "Primary 2"],
    ["200", "Doug's Diner", "Lizbeth Romero", "Lizbeth Romero", "Primary", "70", "Yes", "Sean Marshall", "Secondary", "30", "No"],
  ]);
  assert.equal(files[0].reps.length, 2);
  assert.equal(files[0].reps[1].name, "Sean Marshall");
  assert.equal(files[0].reps[1].pct, 30);
  const line = planSalesReps(files, accounts, known, [
    { customerId: 2, reps: [{ name: "Lizbeth Romero", role: "Primary", pct: 70, primary: true }, { name: "Sean Marshall", role: "Secondary", pct: 30, primary: false }] },
  ])[0];
  assert.equal(line.status, "same");
  assert.equal(line.primaryChange, false);
});

test("two rows in the file that land on one Katz Desk account are both held back", () => {
  const files = salesRepFilesFromMatrix([
    ["Internal ID", "Customer Name", "Primary Sales Rep", "Sales Rep", "Role", "Contribution %", "Primary"],
    ["501", "Starbucks Kingwood", "Sean Marshall", "Sean Marshall", "Sales", "100%", "Yes"],
    ["502", "Starbucks Kingwood", "Lizbeth Romero", "Lizbeth Romero", "Sales", "100%", "Yes"],
  ]);
  const lines = planSalesReps(files, [{ id: 1, name: "Starbucks Kingwood", netsuiteId: null, accountNumber: null, accountRep: "Amanda Logg" }], known, []);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => l.accountId === 1));
  assert.equal(lines.filter((l) => l.willSave).length, 0);
  for (const l of lines) {
    assert.equal(l.status, "unmatched");
    assert.equal(l.primaryChange, false);
    assert.equal(l.nextPrimary, null);
    assert.equal(l.reason, "More than one row in the file matches this Katz Desk account. Nothing is saved.");
  }
  assert.equal(countSalesReps(lines).unmatched, 2);

  // One row by Internal ID and another NetSuite record by exact name: same account, so neither is saved.
  const mixed = salesRepFilesFromMatrix([
    ["Internal ID", "Customer Name", "Primary Sales Rep"],
    ["158", "Woody's Smokehouse", "Sean Marshall"],
    ["777", "Woody's Smokehouse", "Amanda Logg"],
  ]);
  const both = planSalesReps(mixed, accounts, known, []);
  assert.deepEqual(both.map((l) => l.matchedBy), ["internal ID", "name"]);
  assert.ok(both.every((l) => l.status === "unmatched" && !l.willSave));
});
