// The saves and reads in api.ts check what they are sent (11/16 audit, #4; 11/17). Each shape is the TypeScript type
// the function already had. SENT holds what each screen sends today, taken from its call; WRONG holds the kind of
// value a script sends, never a screen. Made-up names throughout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { z } from "zod";

await register("./node-resolve-hook.mjs", import.meta.url);
const input = await import("../src/lib/ops/api-input.ts");
const refuses = (fn, value) =>
  assert.throws(() => fn(value), (e) => e instanceof Error && !(e instanceof z.ZodError) && /couldn.t be read|too long/i.test(e.message) && !e.message.includes("{"), `refuses ${JSON.stringify(value)}`);

const row = { equipment: 'ZZ Brewer 1.5 Gal', serial: "ZZ123", powerVoltage: "120V", recipeId: null, ownership: "Loaned", plug: "5-15", water: "", uid: "u-1", unitId: 44 };
const SENT = {
  listJobsInput: [{ kind: "service" }, { kind: "tlc" }],
  idInput: [{ id: 1 }, { id: 98765 }],
  // job-sheet.tsx: unset fields are sent as undefined.
  newTicketInput: [{ kind: "service", customer: "ZZ Test Diner", issue: "Leaking", urgency: "Normal", technician: undefined, equipment: undefined, received: undefined }, { kind: "tlc", customer: "", issue: "" }],
  // entity-sheets.tsx, planner-calendar.tsx, route-planner.tsx.
  updatePmInput: [{ id: 3, projected: "2026-11-20" }, { id: 3, technician: "sam" }, { id: 3, notes: "x".repeat(50_000), done: true, completedAt: null, po: null, vendorPo: "" }],
  createPmInput: [{ customer: "ZZ Test Diner" }, { customer: "ZZ", equipment: "ZZ Brewer", style: "Standard" }],
  updateModuleInput: [{ id: 2, status: "Ready", wo: null, location: "Bench", dateIn: "2026-11-01", dateReady: null, technician: null, notes: "", platform: "Cameo", moduleType: "Brew" }],
  createModuleInput: [{ moduleId: "ZZ-M-1" }, { moduleId: "ZZ-M-2", platform: "Cameo", moduleType: "Steam" }],
  confirmDealMachinesInput: [
    { dealId: 9, machines: [row, { equipment: "ZZ Grinder", serial: "", powerVoltage: "" }], indexes: [0], project: { mode: "new" } },
    { dealId: 9, machines: [row], indexes: [0, 1], project: { mode: "continue", installId: 4 } },
  ],
  updateDealInput: [{ id: 9, amount: 1200.5, machines: [row], releaseUids: ["u-1"], goodToOrder: true }, { id: 9, amount: null, machines: null, notes: null }, { id: 9, customer: "ZZ Test Diner" }],
  createDealInput: [{ customer: "ZZ Test Diner" }, { customer: "ZZ", producer: "sam", equipment: "ZZ Brewer", machines: [row], amount: 0 }],
  dealIdInput: [{ dealId: 9 }],
  // entity-sheets.tsx sends the list as rows and the base as stored JSON text; install-planner.tsx a date or null.
  updateInstallInput: [
    { id: 4, installDate: "2026-11-18" },
    { id: 4, installDate: null },
    { id: 4, technician: "sam" },
    { id: 4, machines: [row], machinesBase: JSON.stringify([row]), equipment: "ZZ Brewer", serial: "ZZ123", powerVoltage: "120V" },
    { id: 4, machines: null, machinesBase: "[]" },
    { id: 4, duplicateOf: null, complete: true, trfIssued: false, aviKatz: true, installType: "new", siteContact: "", contactPhone: null, notesBase: "", po: "PO-1", vendorPo: null },
  ],
  // installs.tsx: the packed list (text, or null for none).
  createInstallInput: [{ customer: "ZZ Test Diner", equipment: "ZZ Brewer", serial: "ZZ123", powerVoltage: "120V", machines: JSON.stringify([row]) }, { customer: "ZZ", equipment: undefined, machines: null }],
  entityInput: [{ entityType: "install", entityId: 4 }, { entityType: "service", entityId: 12 }],
  // thread.tsx, handoff-reply.tsx.
  addCommentInput: [{ entityType: "install", entityId: 4, body: "Looks good", askTeam: null }, { entityType: "deal", entityId: 9, body: "", askTeam: "sales", authorName: "sam" }],
  resolveCommentInput: [{ id: 5, resolved: true }, { id: 5, resolved: false }],
  searchInput: [{ q: "zz diner" }, { q: "" }],
  // warehouse.tsx and asset-sheet.tsx.
  createAssetInput: [
    { kind: "equip", model: "ZZ Brewer", serial: null, qty: 1, customerOwned: null, site: "barn-back", pallet: "A1", level: 2 },
    { kind: "dispenser", model: "ZZ Dispenser", serial: "D1", qty: 3, customerOwned: "ZZ Test Diner", site: "barn-front", pallet: null, level: null },
  ],
  updateAssetInput: [{ id: 7, qty: 2, notes: "", level: null, pallet: null, site: "field" }, { id: 7, model: "ZZ Brewer", serial: "ZZ9" }],
  assetInstallInput: [{ assetId: 7, installId: 4 }],
  assetServiceInput: [{ assetId: 7, customer: "ZZ Test Diner", jobId: 12 }, { assetId: 7, customer: "ZZ", jobId: null }, { assetId: 7, customer: "ZZ" }],
  assetIdInput: [{ assetId: 7 }],
  returnAssetInput: [{ id: 7, site: "barn-back", pallet: "A1", level: 0 }, { id: 7, site: "barn-front", pallet: "F2", level: 3 }],
  markSoldInput: [{ id: 7, soldTo: "ZZ Test Diner" }],
  directoryKindInput: [{ kind: "customer" }, { kind: "equipment" }],
  nameInput: [{ name: "ZZ Test Diner" }, { name: "" }],
  customerAccountInput: [{ id: 2, aviKatz: true }, { id: 2, accountRep: null }, { id: 2, accountRep: "sam" }],
  addDirectoryInput: [{ kind: "customer", name: "ZZ New Place" }],
  archiveDirectoryInput: [{ kind: "equipment", id: 3 }],
  renameInput: [{ id: 2, name: "ZZ Renamed" }],
  renameCustomerInput: [{ id: 2, name: "ZZ Renamed", confirmMerge: null }, { id: 2, name: "ZZ Renamed", confirmMerge: "ZZ Renamed" }, { id: 2, name: "ZZ" }],
  // machine-fields.tsx, recipe-sheet.tsx, recipes.tsx.
  recipeInput: [
    { name: null, equipmentModel: "ZZ Espresso", customer: null, installId: null, coffee1: "18g", milk: "Whole", notes: null },
    { id: 6, name: "House", equipmentModel: "ZZ Espresso", customer: "ZZ Test Diner", installId: 4, copiedFrom: 2, notes: "Grind: 3" },
  ],
  copyRecipeInput: [{ sourceId: 6, customer: "ZZ Test Diner", installId: 4 }, { sourceId: 6, customer: "ZZ", installId: null }],
  deleteRecipeInput: [{ id: 6, force: false, exceptDealId: null, exceptIndex: null }, { id: 6, force: true, exceptDealId: 9, exceptIndex: 0 }],
};
const WRONG = {
  listJobsInput: [{ kind: "pm" }, {}, { kind: 1 }],
  idInput: [{ id: "1" }, { id: 1.5 }, { id: 0 }, { id: null }, {}],
  newTicketInput: [{ kind: "service" }, { kind: "x", customer: "ZZ" }, { kind: "service", customer: 5 }, { kind: "service", customer: "ZZ", issue: {} }, { kind: "service", customer: "x".repeat(3000) }],
  updatePmInput: [{ id: "3" }, { id: 3, done: "yes" }, { id: 3, notes: 5 }, { projected: "2026-11-20" }],
  createPmInput: [{}, { customer: ["ZZ"] }],
  updateModuleInput: [{ id: 2, status: 1 }, { status: "Ready" }],
  createModuleInput: [{}, { moduleId: 5 }],
  confirmDealMachinesInput: [
    { dealId: 9, machines: [row], indexes: [0], project: { mode: "other" } },
    { dealId: 9, machines: [row], indexes: [0], project: { mode: "continue" } },
    { dealId: 9, machines: "rows", indexes: [0], project: { mode: "new" } },
    { dealId: 9, machines: [{ equipment: 5 }], indexes: [0], project: { mode: "new" } },
    { dealId: 9, machines: [row], indexes: [-1], project: { mode: "new" } },
  ],
  updateDealInput: [{ id: 9, amount: "1200" }, { id: 9, amount: NaN }, { id: 9, machines: "[]" }, { id: 9, releaseUids: "u-1" }, { id: 9, goodToOrder: 1 }],
  createDealInput: [{}, { customer: "ZZ", amount: Infinity }],
  dealIdInput: [{ dealId: "9" }, {}],
  updateInstallInput: [{ id: 4, machines: 5 }, { id: 4, machines: [{ serial: 5 }] }, { id: 4, complete: "true" }, { id: 4, duplicateOf: "3" }, { installDate: "2026-11-18" }, { id: 4, notes: "x".repeat(200_001) }],
  createInstallInput: [{}, { customer: "ZZ", machines: {} }],
  entityInput: [{ entityType: "install" }, { entityType: 1, entityId: 4 }, { entityType: "install", entityId: "4" }],
  addCommentInput: [{ entityType: "install", entityId: 4 }, { entityType: "install", entityId: 4, body: 5 }],
  resolveCommentInput: [{ id: 5 }, { id: 5, resolved: "true" }],
  searchInput: [{}, { q: 5 }, { q: "x".repeat(3000) }],
  createAssetInput: [{ model: "ZZ" }, { model: "ZZ", site: "barn-back", kind: "boat" }, { model: "ZZ", site: "barn-back", qty: "1" }, { model: "ZZ", site: "barn-back", level: NaN }],
  updateAssetInput: [{ id: 7, qty: "2" }, { id: 7, site: null }, {}],
  assetInstallInput: [{ assetId: 7 }, { assetId: "7", installId: 4 }],
  assetServiceInput: [{ assetId: 7 }, { assetId: 7, customer: "ZZ", jobId: "12" }],
  assetIdInput: [{}, { assetId: 0 }],
  returnAssetInput: [{ id: 7, site: "field", pallet: "A1", level: 1 }, { id: 7, site: "barn-back", pallet: "A1" }],
  markSoldInput: [{ id: 7 }, { id: 7, soldTo: 5 }],
  directoryKindInput: [{ kind: "vendor" }, {}],
  nameInput: [{}, { name: 5 }],
  customerAccountInput: [{ id: 2, aviKatz: "yes" }, { aviKatz: true }],
  addDirectoryInput: [{ kind: "customer" }, { kind: "vendor", name: "ZZ" }],
  archiveDirectoryInput: [{ kind: "customer" }, { kind: "customer", id: "3" }],
  renameInput: [{ id: 2 }, { id: 2, name: 5 }],
  renameCustomerInput: [{ id: 2, name: "ZZ", confirmMerge: 1 }, { name: "ZZ" }],
  recipeInput: [{}, { equipmentModel: 5 }, { equipmentModel: "ZZ", installId: "4" }, { equipmentModel: "ZZ", coffee1: 18 }],
  copyRecipeInput: [{ sourceId: 6 }, { sourceId: "6", customer: "ZZ" }],
  deleteRecipeInput: [{ id: 6, force: "yes" }, { id: 6, exceptIndex: -1 }, {}],
};

test("every input in api-input.ts takes what its screen sends", () => {
  assert.deepEqual(Object.keys(SENT).sort(), Object.keys(input).filter((k) => k !== "machineRow").sort(), "one entry per exported input");
  for (const [name, values] of Object.entries(SENT)) {
    for (const v of values) assert.doesNotThrow(() => input[name](v), `${name} takes ${JSON.stringify(v).slice(0, 200)}`);
  }
});

test("and refuses the wrong kind of value, in one plain sentence", () => {
  assert.deepEqual(Object.keys(WRONG).sort(), Object.keys(SENT).sort());
  for (const [name, values] of Object.entries(WRONG)) for (const v of values) refuses(input[name], v);
});

test("what is sent comes back the same: missing stays missing, null stays null, machine rows keep every field", () => {
  assert.deepEqual(input.updateInstallInput({ id: 4, installDate: null }), { id: 4, installDate: null });
  assert.deepEqual(input.updateInstallInput({ id: 4 }), { id: 4 });
  assert.equal("machines" in input.updateInstallInput({ id: 4, notes: "x" }), false, "a list not sent is not saved as empty");
  const weird = { ...row, someLaterField: "kept", nested: { a: 1 } };
  assert.deepEqual(input.updateInstallInput({ id: 4, machines: [weird] }).machines, [weird]);
  assert.deepEqual(input.confirmDealMachinesInput({ dealId: 9, machines: [weird], indexes: [0], project: { mode: "new" } }).machines, [weird]);
  // A field the type never had is dropped at the top level: no handler reads one.
  assert.deepEqual(input.updatePmInput({ id: 3, projected: "2026-11-20", injected: "x" }), { id: 3, projected: "2026-11-20" });
});

test("each api.ts function takes the input its type had", () => {
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  const uses = [...api.matchAll(/export const (\w+) = createServerFn[^\n]*\n?\s*\.middleware\(\[\w+\]\)\s*\n?\s*\.validator\(input\.(\w+)\)/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.equal(uses.length, 41);
  for (const pair of ["getJob:idInput", "archiveDeal:idInput", "archiveInstall:idInput", "claimComment:idInput", "getCustomerHistory:idInput", "updateInstall:updateInstallInput", "upsertRecipe:recipeInput", "listComments:entityInput", "listActivity:entityInput", "previewCustomerRename:renameInput", "renameEquipment:renameInput", "assignAssetToInstall:assetInstallInput", "unassignAssetFromInstall:assetInstallInput"]) {
    assert.ok(uses.includes(pair), pair);
  }
});
