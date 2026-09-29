import assert from "node:assert/strict";
import {
  customerLocationMessage,
  isWarehouseStockPlace,
  removeReasonError,
} from "../src/lib/ops/stock-action-rules.ts";

assert.equal(removeReasonError("Other", "  "), "Other needs a note.");
assert.equal(removeReasonError("Other", "scrapped frame"), null);
assert.equal(removeReasonError("Scrap / beyond repair", ""), null);
assert.equal(removeReasonError("Nope", ""), "Pick a reason.");
assert.equal(isWarehouseStockPlace("barn-front"), true);
assert.equal(isWarehouseStockPlace("barn-back"), true);
assert.equal(isWarehouseStockPlace("staging"), true);
assert.equal(isWarehouseStockPlace("training"), true);
assert.equal(isWarehouseStockPlace("front-lobby"), true);
assert.equal(isWarehouseStockPlace("service-room"), false);
assert.equal(isWarehouseStockPlace("account"), false);
assert.match(customerLocationMessage("Baldi"), /Baldi/);
assert.match(customerLocationMessage("Baldi"), /Move it off the account first/);

console.log("stock-action rules ok");
