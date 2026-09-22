import assert from "node:assert/strict";
import {
  customersCompatible,
  deskHasWrapped,
  detectBoard,
  hitClosed,
  indexHits,
  isWalkIn,
  matchNote,
  parseCorrigoMatrix,
  pickKeeper,
  preferredImportCustomer,
  resolvePreviewRow,
  shouldAttachToHit,
  woCanonical,
  woCore,
  woMatchKey,
  woNumeric,
} from "../src/lib/ops/corrigo.ts";

assert.equal(woMatchKey("WO-5440"), "5440");
assert.equal(woMatchKey("WO5440"), "5440");
assert.equal(woMatchKey("5440"), "5440");
assert.equal(woMatchKey("  5440  "), "5440");
assert.equal(woMatchKey("#5440"), "5440");
assert.equal(woMatchKey("ST#5440"), "5440");
assert.equal(woMatchKey("ST-5440"), "5440");
assert.equal(woMatchKey("WO- 5440"), "5440");
assert.equal(woMatchKey("WO-0548"), "548");
assert.equal(woMatchKey("548"), "548");
assert.equal(woMatchKey("0548"), "548");
assert.equal(woMatchKey("WO#5440"), "5440");
assert.equal(woMatchKey("W.O. 5440"), "5440");
assert.equal(woMatchKey("WORK ORDER 5440"), "5440");
assert.equal(woMatchKey("5440.0"), "5440");
assert.equal(woMatchKey("WO-5440.0"), "5440");
assert.equal(woCore("WO–5440"), "5440");
assert.equal(woCanonical("5440"), "WO-5440");
assert.equal(woCanonical("WO5440"), "WO-5440");
assert.equal(woCanonical("  5440  "), "WO-5440");
assert.equal(woCanonical("#5440"), "WO-5440");
assert.equal(woCanonical("WO-0548"), "WO-0548");
assert.equal(matchNote("5440", "WO-5440"), "matched as 5440 → WO-5440");
assert.equal(matchNote("WO5440", "WO-5440"), "matched as WO5440 → WO-5440");
assert.equal(matchNote("WO-5440", "WO-5440"), null);

assert.equal(isWalkIn("Walk-In"), true);
assert.equal(isWalkIn("Walk - In"), true);
assert.equal(isWalkIn("Walk in"), true);
assert.equal(isWalkIn("WALK IN"), true);
assert.equal(isWalkIn("Walk-In Cafe"), false);
assert.equal(preferredImportCustomer("Walk-In", "El Rey- Katy"), "El Rey- Katy");
assert.equal(preferredImportCustomer("Walk - In", null), null);
assert.equal(preferredImportCustomer("Uptown Catering", "El Rey- Katy"), "Uptown Catering");
assert.equal(preferredImportCustomer("", "El Rey- Katy"), "El Rey- Katy");

assert.equal(detectBoard({ po: "TLC-1" }), "tlc");
assert.equal(detectBoard({ po: "Factor run" }), "tlc");
assert.equal(detectBoard({ po: "Install" }), "install");
assert.equal(detectBoard({ issue: "Preventative maintenance visit" }), "pm");
assert.equal(detectBoard({ issue: "Installation of new machine" }), "install");
assert.equal(detectBoard({ callType: "PM" }), "pm");
assert.equal(detectBoard({ issue: "TLC on site", existing: "service" }), "service");

assert.equal(customersCompatible("Houston's - Kirby", "Houston's - Kirby"), true);
assert.equal(customersCompatible("State Fare Woodlands", "State Fare - Woodlands"), true);
assert.equal(customersCompatible("Kolache 360", "oceans 48 newport beach"), false);
assert.equal(customersCompatible("le peep - memorial", "le peep - westheimer"), false);
assert.equal(customersCompatible("Walk-In", "El Rey- Katy"), true);
assert.equal(customersCompatible("", "Match Cafe"), true);

const hits = indexHits([
  { board: "service", id: 1, status: "Open", customer: "A", wo: "WO5440" },
  { board: "service", id: 2, status: "Open", customer: "B", wo: "WO-5440" },
  { board: "tlc", id: 9, status: "Open", customer: "T", wo: "WO-9505" },
  { board: "install", id: 3, status: "Ready", customer: "I", wo: "WO-0406" },
]);
assert.equal(hits.get("5440")?.unique?.id, 1);
assert.equal(hits.get("5440")?.conflicts.length, 1);
assert.equal(hits.get("5440")?.conflicts[0]?.id, 2);
assert.equal(hits.get("9505")?.unique?.board, "tlc");
assert.equal(hits.get("406")?.unique?.board, "install");

const mixed = indexHits([
  { board: "install", id: 3, status: "Ready", customer: "Cowgirl", wo: "WO-9477" },
  { board: "service", id: 10, status: "Completed", customer: "Cowgirls Coffee", wo: "WO-9477" },
]);
assert.equal(mixed.get("9477")?.unique?.board, "service");
assert.equal(
  pickKeeper(mixed.get("9477") ? [mixed.get("9477").unique, ...mixed.get("9477").conflicts] : [], "install")
    ?.board,
  "install",
);

const parsed = parseCorrigoMatrix([
  ["ST#", "Primary Service Tech", "Work Done", "Operational Status", "Problem Description", "Customer Name", "P.O. #"],
  ["5440", "Ryan", "Boiler cleaned.", "completed", "No heat.", "Match Cafe", ""],
  ["WO9505", "Oliver", "TLC visit.", "work started", "TLC on site", "Tejas", "TLC"],
  ["#0406", "Josh", "Site check.", "en route", "Installation follow-up", "Southern Ice CO", "Install"],
  ["WO-8881", "Lance", "Filter change.", "work started", "Preventative maintenance visit", "Epicure Café", "PM-12"],
]);
const byKey = Object.fromEntries(parsed.records.map((r) => [r.matchKey, r]));
assert.equal(byKey["5440"].canonicalWo, "WO-5440");
const tlc = resolvePreviewRow(byKey["9505"], hits.get("9505") ?? { unique: null, conflicts: [] });
assert.equal(tlc.action, "update");
assert.equal(tlc.board, "tlc");
assert.equal(tlc.boardLabel, "TLC / Factor");
assert.match(tlc.matchNote ?? "", /matched as WO9505 → WO-9505/);
const inst = resolvePreviewRow(byKey["406"], hits.get("406") ?? { unique: null, conflicts: [] });
assert.equal(inst.action, "update");
assert.equal(inst.board, "install");
const pm = resolvePreviewRow(byKey["8881"], { unique: null, conflicts: [] });
assert.equal(pm.action, "create");
assert.equal(pm.board, "pm");
const conflict = resolvePreviewRow(byKey["5440"], hits.get("5440") ?? { unique: null, conflicts: [] });
assert.equal(conflict.action, "update");
assert.equal(conflict.jobId, 1);
assert.ok(conflict.conflictIds?.length === 1);
assert.equal(conflict.conflictIds[0].id, 2);

const update5440 = resolvePreviewRow(byKey["5440"], {
  unique: { board: "service", id: 88, status: "Open", customer: "Match Cafe", wo: "WO5440" },
  conflicts: [],
});
assert.equal(update5440.action, "update");
assert.equal(update5440.canonicalWo, "WO-5440");
assert.equal(update5440.matchNote, "matched as 5440 → WO-5440");
assert.equal(update5440.jobId, 88);

const walkRec = {
  rawWo: "WO-2001",
  matchKey: "2001",
  canonicalWo: "WO-2001",
  technician: "Oliver",
  completedAt: null,
  workDone: "Walk-in boiler check.",
  statusRaw: "work started",
  issue: "No steam",
  customer: "Walk - In",
  po: null,
  callType: null,
};
const walk = resolvePreviewRow(walkRec, { unique: null, conflicts: [] });
assert.equal(walk.fileWalkIn, true);
assert.equal(walk.customer, null);
assert.equal(walk.action, "create");
const walkExisting = resolvePreviewRow(walkRec, {
  unique: { board: "service", id: 5, status: "Open", customer: "El Rey- Katy", wo: "WO-2001" },
  conflicts: [],
});
assert.equal(walkExisting.customer, "El Rey- Katy");
assert.equal(walkExisting.fileWalkIn, true);
assert.equal(walkExisting.existingCustomer, "El Rey- Katy");

assert.equal(woNumeric("WO-9999"), 9999);
assert.equal(woNumeric("WO-0003"), 3);
assert.equal(deskHasWrapped([{ wo: "WO-5440" }]), false);
assert.equal(deskHasWrapped([{ wo: "WO-9999" }, { wo: "WO-0003" }]), true);
assert.equal(hitClosed({ status: "Completed" }), true);
assert.equal(hitClosed({ status: "Dispatched", done: true }), true);
assert.equal(hitClosed({ status: "Open" }), false);

const closedOld = {
  board: "service",
  id: 71,
  status: "Completed",
  customer: "LMMM #60 - Fresno",
  wo: "WO-0003",
  done: true,
};
const rec0003 = {
  rawWo: "0003",
  matchKey: "3",
  canonicalWo: "WO-0003",
  technician: "Ryan",
  completedAt: null,
  workDone: "New cycle boiler.",
  statusRaw: "work started",
  issue: "No heat",
  customer: "Match Cafe",
  po: null,
  callType: null,
};
assert.equal(shouldAttachToHit(closedOld, "Match Cafe", true), false);
assert.equal(shouldAttachToHit(closedOld, "LMMM #60 - Fresno", true), true);
const reuse = resolvePreviewRow(rec0003, { unique: closedOld, conflicts: [] }, { wrapped: true });
assert.equal(reuse.action, "create");
assert.equal(reuse.jobId, null);
assert.equal(reuse.wrapRepeat, true);
assert.match(reuse.matchNote ?? "", /used again after 9999/);
const sameCycle = resolvePreviewRow(
  { ...rec0003, customer: "LMMM #60 - Fresno" },
  { unique: closedOld, conflicts: [] },
  { wrapped: true },
);
assert.equal(sameCycle.action, "update");
assert.equal(sameCycle.wrapRepeat, false);
const wrapCollision = resolvePreviewRow(
  rec0003,
  {
    unique: { board: "service", id: 8, status: "Open", customer: "Match Cafe", wo: "WO-0003" },
    conflicts: [{ board: "service", id: 71, status: "Completed", customer: "LMMM #60 - Fresno", wo: "WO-0003", done: true }],
  },
  { wrapped: true },
);
assert.equal(wrapCollision.action, "update");
assert.equal(wrapCollision.jobId, 8);
assert.equal(wrapCollision.wrapRepeat, true);

console.log("corrigo matching ok");
