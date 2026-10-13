import assert from "node:assert/strict";
import { lastMoveLine, placeDraftError, placeMove, unitPlaceLabel } from "../src/lib/ops/unit-place-rules.ts";

assert.equal(placeMove(null), "create");
assert.equal(placeMove({ status: "ready" }), "move");
assert.equal(placeMove({ status: "assigned" }), "blocked");
assert.equal(unitPlaceLabel({ site: "barn-back", pallet: "g", level: 1, status: "ready" }), "Back · G-L1");
assert.equal(unitPlaceLabel({ site: "barn-front", pallet: "G", level: 1, status: "ready" }), "Front · G-L1");
assert.equal(placeDraftError({ site: "barn-front", pallet: "K" }), "Pick a level.");
assert.equal(placeDraftError({ site: "barn-front", pallet: "K", level: "1" }), null);
assert.equal(unitPlaceLabel({ site: "training", status: "deployed" }), "Training");
assert.equal(unitPlaceLabel({ site: "front-lobby", status: "deployed" }), "Lobby");
assert.equal(unitPlaceLabel({ site: "staging", status: "deployed" }), "Staging area");
assert.equal(unitPlaceLabel({ site: "other", purpose: "parts cage", status: "deployed" }), "parts cage");
assert.equal(placeDraftError({ site: "barn-back", pallet: "" }), "Pick a bay A through P.");
assert.equal(placeDraftError({ site: "" }), "Pick a rack.");
assert.equal(placeDraftError({ site: "other", otherLabel: "  " }), "Other needs a short label.");
assert.equal(placeDraftError({ site: "training" }), null);
assert.equal(lastMoveLine("note\nMoved from Barn · A to Training · ada · today"), "Moved from Barn · A to Training · ada · today");
console.log("unit place ok");

// Front rack is bays I–P only; Back rack is A–P.
{
  const { rackBayError } = await import("../src/lib/ops/warehouse.ts");
  assert.equal(rackBayError("barn-back", "A"), null);
  assert.equal(rackBayError("barn-back", "P"), null);
  assert.equal(rackBayError("barn-front", "I"), null);
  assert.equal(rackBayError("barn-front", "p"), null);
  assert.equal(rackBayError("barn-front", "A"), "The Front rack only has bays I through P.");
  assert.equal(rackBayError("barn-front", "H"), "The Front rack only has bays I through P.");
  assert.equal(rackBayError("barn-front", ""), "Pick a bay I through P");
  assert.equal(rackBayError("barn-back", "Q"), "Pick a bay A through P");
  assert.equal(placeDraftError({ site: "barn-front", pallet: "C", level: "2" }), "The Front rack only has bays I through P.");
  assert.equal(placeDraftError({ site: "barn-front", pallet: "K", level: "2" }), null);
  assert.equal(placeDraftError({ site: "barn-front", pallet: "" }), "Pick a bay I through P.");
}

// A unit assigned to an account, or sold, is locked in place.
{
  const { placeMove } = await import("../src/lib/ops/unit-place-rules.ts");
  assert.equal(placeMove({ status: "assigned" }), "blocked");
  assert.equal(placeMove({ status: "sold" }), "blocked");
  assert.equal(placeMove({ status: "ready" }), "move");
  assert.equal(placeMove({ status: "deployed" }), "move");
  assert.equal(placeMove(null), "create");
}
