import assert from "node:assert/strict";
import { lastMoveLine, placeDraftError, placeMove, unitPlaceLabel } from "../src/lib/ops/unit-place-rules.ts";

assert.equal(placeMove(null), "create");
assert.equal(placeMove({ status: "ready" }), "move");
assert.equal(placeMove({ status: "assigned" }), "blocked");
assert.equal(unitPlaceLabel({ site: "barn-back", pallet: "g", level: 1, status: "ready" }), "Barn · G-L1");
assert.equal(placeDraftError({ site: "barn", pallet: "G" }), "Pick a level.");
assert.equal(placeDraftError({ site: "barn", pallet: "G", level: "1" }), null);
assert.equal(unitPlaceLabel({ site: "training", status: "deployed" }), "Training");
assert.equal(unitPlaceLabel({ site: "front-lobby", status: "deployed" }), "Lobby");
assert.equal(unitPlaceLabel({ site: "staging", status: "deployed" }), "Staging area");
assert.equal(unitPlaceLabel({ site: "other", purpose: "parts cage", status: "deployed" }), "parts cage");
assert.equal(placeDraftError({ site: "barn", pallet: "" }), "Pick a bay A through P.");
assert.equal(placeDraftError({ site: "other", otherLabel: "  " }), "Other needs a short label.");
assert.equal(placeDraftError({ site: "training" }), null);
assert.equal(lastMoveLine("note\nMoved from Barn · A to Training · ada · today"), "Moved from Barn · A to Training · ada · today");
console.log("unit place ok");
