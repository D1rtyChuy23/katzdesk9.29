import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_WATER_NOTE,
  boardRow,
  cleanMachine,
  confirmError,
  continuable,
  isOwnership,
  keepTies,
  machineGlance,
  placeRows,
  projectLabel,
  projectStatus,
  ticketLine,
  ticketLines,
  ticketOpen,
  waterNeed,
} from "../src/lib/ops/deal-board.ts";

const linea = { equipment: "La Marzocco Linea PB", serial: "LM123", powerVoltage: "208V", ownership: "Sold", plug: "L6-30P", water: '3/8" line', coffee: "House Espresso", recipeId: 7 };
const g9 = { equipment: "BUNN G9-2T HD", serial: "", powerVoltage: "120V", ownership: "Loaned", plug: "5-15P", water: "typed by mistake", coffee: "Breakfast Blend", recipeId: null };

test("equipment is marked Sold or Loaned, nothing else", () => {
  assert.equal(isOwnership("Sold"), true);
  assert.equal(isOwnership("Loaned"), true);
  assert.equal(isOwnership("sold"), false);
  assert.equal(isOwnership(""), false);
  assert.equal(cleanMachine({ ...linea, ownership: "Leased" }).ownership, "");
});

test("a machine is not confirmed until it is marked Sold or Loaned", () => {
  assert.match(confirmError({ equipment: "", ownership: "Sold" }), /model/);
  assert.match(confirmError({ equipment: "Linea PB", ownership: "" }), /Sold or Loaned/);
  assert.equal(confirmError({ equipment: "Linea PB", ownership: "Loaned" }), null);
});

test("a grinder has no water or drain; a brewer and an espresso machine need water", () => {
  assert.equal(waterNeed("BUNN G9-2T HD"), "none");
  assert.equal(waterNeed("Mazzer Robur"), "none");
  // Grinders whose names do not say "grinder".
  assert.equal(waterNeed("Mythos"), "none");
  assert.equal(waterNeed("Bunn G2 HD, BLK"), "none");
  assert.equal(waterNeed("Bunn G9-2 HD Dual Portion Grinder"), "none");
  assert.equal(waterNeed("Bunn H5X Element 120V 1800W"), "optional");
  assert.equal(waterNeed("BUNN Axiom DV-APS"), "required");
  assert.equal(waterNeed("La Marzocco Linea PB"), "required");
  assert.equal(waterNeed("Milk Fridge"), "optional");
  // Whatever was typed, a grinder never carries a water value.
  assert.equal(cleanMachine(g9).water, "");
  assert.equal(ticketLine(g9, "G9 house").water, null);
  assert.equal(NO_WATER_NOTE, "No water or drain");
});

test("a confirmed machine takes everything set on the deal to the Board", () => {
  const row = boardRow({ ...linea, confirmedAt: "2026-10-12", boardId: 4 }, "u1");
  assert.deepEqual(row, {
    equipment: "La Marzocco Linea PB",
    serial: "LM123",
    powerVoltage: "208V",
    recipeId: 7,
    ownership: "Sold",
    plug: "L6-30P",
    water: '3/8" line',
    coffee: "House Espresso",
    uid: "u1",
  });
  // The deal's own stamps stay on the deal.
  assert.equal("confirmedAt" in row, false);
  assert.equal("boardId" in row, false);
});

test("the install ticket is filled from the project: recipe, volts, plug, water, coffee", () => {
  const [a, b] = ticketLines([boardRow(linea, "u1"), boardRow(g9, "u2")], (id) => (id === 7 ? "Morning Espresso" : null));
  assert.deepEqual(a, {
    model: "La Marzocco Linea PB",
    ownership: "Sold",
    serial: "LM123",
    volts: "208V",
    plug: "L6-30P",
    water: '3/8" line',
    waterNeed: "required",
    recipe: "Morning Espresso",
    coffee: "House Espresso",
    missing: [],
  });
  assert.equal(b.ownership, "Loaned");
  assert.equal(b.water, null);
  assert.equal(b.waterNeed, "none");
  // A grinder is never asked for water; it is asked for the recipe it has none of.
  assert.deepEqual(b.missing, ["Recipe"]);
});

test("the ticket names what is still blank, and never asks a fridge for coffee", () => {
  const bare = ticketLine({ equipment: "BUNN Axiom DV-APS", serial: "", powerVoltage: "" }, null);
  assert.deepEqual(bare.missing, ["Sold or Loaned", "Volts", "Plug", "Water", "Recipe", "Coffee"]);
  const fridge = ticketLine({ equipment: "Milk Fridge", serial: "", powerVoltage: "120V", plug: "5-15P", ownership: "Sold" }, null);
  assert.deepEqual(fridge.missing, []);
  assert.equal(fridge.water, "");
});

test("the ticket opens only when the project is Ready", () => {
  assert.equal(ticketOpen("Ready", "Passed"), true);
  assert.equal(ticketOpen("Ready", "In progress"), false);
  assert.equal(ticketOpen("Not Ready", "Passed"), false);
  assert.equal(projectStatus({ installed: false, equipStatus: "Ready", overall: "Passed" }), "Ready");
  assert.equal(projectStatus({ installed: false, equipStatus: "Not Ready", overall: "Passed" }), "In Prep");
  assert.equal(projectStatus({ installed: true, equipStatus: "Installed", overall: "Passed" }), "Installed");
});

const projects = [
  { id: 10, dealId: 3, customer: "Coco Crepes", installed: false, machines: [{ equipment: "La Marzocco Linea PB", uid: "u1" }] },
  { id: 11, dealId: 3, customer: "Coco Crepes", installed: true, machines: [{ equipment: "BUNN G9-2T HD", uid: "u2" }] },
  { id: 12, dealId: null, customer: "coco crepes", installed: false, machines: [] },
  { id: 13, dealId: 8, customer: "Coco Crepes", installed: false, machines: [] },
  { id: 14, dealId: null, customer: "Other Cafe", installed: false, machines: [] },
];

test("a later machine may continue under an open project of this deal or this account", () => {
  const open = continuable({ id: 3, customer: "Coco Crepes" }, projects);
  // Not the installed one, not another deal's, not another account's.
  assert.deepEqual(open.map((p) => p.id), [10, 12]);
  // Nothing open: there is nothing to ask, the machine starts a project.
  assert.deepEqual(continuable({ id: 99, customer: "New Account" }, projects), []);
});

test("a deal row is on the Board when its board row exists, whatever the model was renamed to", () => {
  const rows = [
    { equipment: "Linea PB", serial: "", powerVoltage: "", uid: "u1" },
    { equipment: "BUNN G9-2T HD", serial: "", powerVoltage: "", uid: "u2" },
    { equipment: "BUNN Axiom", serial: "", powerVoltage: "", uid: "gone" },
    { equipment: "FETCO CBS-1250", serial: "", powerVoltage: "" },
  ];
  assert.deepEqual(placeRows(rows, projects, { id: 3, handedOff: false }), [10, 11, null, null]);
});

test("a deal handed off before machines were tracked matches its own project by model, one row each", () => {
  const old = [{ id: 20, dealId: 5, customer: "Blue Door", installed: false, machines: [{ equipment: "BUNN G9-2T HD" }, { equipment: "BUNN Axiom DV-APS" }] }];
  const rows = [
    { equipment: "BUNN G9-2T HD", serial: "", powerVoltage: "" },
    { equipment: "bunn g9 2t hd", serial: "", powerVoltage: "" },
    { equipment: "BUNN Axiom DV-APS", serial: "", powerVoltage: "" },
  ];
  // Two grinders on the deal, one on the Board: the second is not on the Board yet.
  assert.deepEqual(placeRows(rows, old, { id: 5, handedOff: true }), [20, null, 20]);
  // Not handed off: nothing is assumed.
  assert.deepEqual(placeRows(rows, old, { id: 5, handedOff: false }), [null, null, null]);
});

test("project labels and the one-line glance on a board card", () => {
  assert.equal(projectLabel(1, 1), "Project");
  assert.equal(projectLabel(2, 3), "Project 2 of 3");
  assert.equal(machineGlance(linea), 'Sold · SN LM123 · 208V · L6-30P · Water 3/8" line · Coffee: House Espresso');
  assert.equal(machineGlance(g9), "Loaned · 120V · 5-15P · Coffee: Breakfast Blend");
});

test("a window opened before a machine was confirmed does not drop its tie when it saves", () => {
  const stored = [
    { equipment: "BUNN G9-2T HD", uid: "u1", confirmedAt: "2026-10-12" },
    { equipment: "BUNN G9-2T HD", uid: "u2", confirmedAt: "2026-10-12" },
    { equipment: "BUNN Axiom", uid: "u3", confirmedAt: "2026-10-11" },
  ];
  const fromWindow = [
    { equipment: "BUNN G9-2T HD", serial: "A" },
    { equipment: "BUNN G9-2T HD", serial: "B", uid: "u2" },
    { equipment: "BUNN Axiom", serial: "C" },
    { equipment: "FETCO CBS-1250", serial: "D" },
  ];
  const kept = keepTies(fromWindow, stored);
  // u2 is already on its row, so the untied grinder takes u1; nothing is tied twice.
  assert.deepEqual(kept.map((m) => m.uid ?? null), ["u1", "u2", "u3", null]);
  assert.equal(kept[2].confirmedAt, "2026-10-11");
  assert.equal(kept[0].serial, "A");
  // Nothing stored, nothing invented.
  assert.deepEqual(keepTies([{ equipment: "X" }], []), [{ equipment: "X" }]);
});

test("a confirmed machine is read-only on the deal: the stored row wins and is never dropped", async () => {
  const { lockConfirmed } = await import("../src/lib/ops/deal-board.ts");
  const stored = [
    { equipment: "Mythos", serial: "A1", powerVoltage: "120V", uid: "u1" },
    { equipment: "Linea", serial: "", powerVoltage: "", uid: "" },
  ];
  const onBoard = new Set(["u1"]);
  const sent = [{ equipment: "Mythos", serial: "CHANGED", powerVoltage: "208V", uid: "u1" }, { equipment: "Linea", serial: "L9", powerVoltage: "208V", uid: "" }];
  assert.deepEqual(lockConfirmed(sent, stored, onBoard).map((m) => m.serial), ["A1", "L9"]);
  // a window that left the confirmed row out keeps it
  assert.deepEqual(lockConfirmed([sent[1]], stored, onBoard).map((m) => m.equipment), ["Linea", "Mythos"]);
  // a tie whose board row is gone is not held
  assert.equal(lockConfirmed(sent, stored, new Set())[0].serial, "CHANGED");
});
