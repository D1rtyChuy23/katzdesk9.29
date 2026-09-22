import assert from "node:assert/strict";

function serialKey(raw) {
  return (raw ?? "").trim().replace(/[#\s]/g, "").toLowerCase();
}

assert.equal(serialKey("  #0183330226105C0012 "), "0183330226105c0012");
assert.equal(serialKey("G9 510 20201"), "g951020201");
assert.equal(serialKey(""), "");
console.log("serialKey ok");
