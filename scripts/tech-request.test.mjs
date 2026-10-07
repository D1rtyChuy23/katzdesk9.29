import test from "node:test";
import assert from "node:assert/strict";
import { techRequestPing } from "../src/lib/ops/tech-request.ts";

test("the rep ping names the tech, the account, and the Tech Request Form", () => {
  const body = techRequestPing("Ryan Gloria", "Katz's Deli and Bar - Houston");
  assert.equal(body, "Ryan Gloria is assigned to the Katz's Deli and Bar - Houston install. You are good to issue the Tech Request Form.");
});
