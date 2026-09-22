import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isInstalled, isOpenInstall, installedPatch } from "../src/lib/ops/install-status.ts";
import { sameTech, canonicalTechName, DEFAULT_TECHS } from "../src/lib/ops/tech-match.ts";
import { isWalkIn, normalizeCustomerKey } from "../src/lib/ops/customer-key.ts";
import {
  CLOSED_CALL,
  CLOSED_PM,
  isClosedCall,
  isOpenCall,
  isClosedPm,
  isOpenPm,
} from "../src/lib/ops/ticket-status.ts";
import { flagOn } from "../src/lib/ops/flag.ts";
import { normalizeName } from "../src/lib/ops/norm.ts";
import { isoDay, isoDayOrNull, diffDays } from "../src/lib/ops/iso.ts";
import { mineByTechnician } from "../src/lib/ops/my-view.ts";

assert.equal(isInstalled({ complete: false, equipStatus: "Ready" }), false);
assert.equal(isInstalled({ complete: true, equipStatus: "Ready" }), true);
assert.equal(isInstalled({ complete: false, equipStatus: "Installed" }), true);
assert.equal(isOpenInstall({ complete: false, equipStatus: "Not Ready" }), true);
assert.equal(isOpenInstall({ complete: true, equipStatus: "Ready" }), false);

const kept = installedPatch({ installDate: "2026-08-01" }, "2026-09-22");
assert.equal(kept.equipStatus, "Installed");
assert.equal(kept.complete, true);
assert.equal(kept.completedAt, "2026-09-22");
assert.equal(kept.installDate, "2026-08-01");
assert.equal(installedPatch({}, "2026-09-22").installDate, "2026-09-22");

const clock = readFileSync(new URL("../src/lib/ops/clock.ts", import.meta.url), "utf8");
assert.match(clock, /WEEKDAYS = \["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"\]/);
assert.match(clock, /export \{ isInstalled, isOpenInstall, installedPatch \}/);
assert.match(clock, /isClosedCall/);
assert.match(clock, /isClosedPm/);

const lookups = readFileSync(new URL("../src/lib/ops/lookups.ts", import.meta.url), "utf8");
assert.match(lookups, /DEFAULT_TECHS as TECHNICIANS/);
assert.match(lookups, /canonicalTechName,\s*\n\s*sameTech/);
assert.match(lookups, /from "\.\/ticket-status"/);

assert.equal(canonicalTechName("Ryan"), "Ryan Gloria");
assert.ok(sameTech("Ryan", "Ryan Gloria"));
assert.ok(sameTech("McKinsley", "Bill McKinley"));
assert.equal(sameTech("Garcia", "Oliver Garcia"), false);
assert.ok(DEFAULT_TECHS.includes("Brandon Chappell"));

assert.equal(isWalkIn("Walk-In"), true);
assert.equal(isWalkIn("Walk - In"), true);
assert.equal(isWalkIn("Walk in"), true);
assert.equal(isWalkIn("WALK IN"), true);
assert.equal(isWalkIn("Walk-In Cafe"), false);
assert.equal(normalizeCustomerKey("First  Market"), "firstmarket");

const corrigoSrc = readFileSync(new URL("../src/lib/ops/corrigo.ts", import.meta.url), "utf8");
assert.match(corrigoSrc, /from "\.\/customer-key\.ts"/);
assert.doesNotMatch(corrigoSrc, /export function isWalkIn/);
const accountSrc = readFileSync(new URL("../src/lib/ops/account-equip.ts", import.meta.url), "utf8");
assert.match(accountSrc, /from "\.\/customer-key\.ts"/);
assert.doesNotMatch(accountSrc, /export function isWalkIn/);

assert.ok(CLOSED_CALL.has("Phone Resolved"));
assert.ok(CLOSED_PM.has("Cancelled"));
assert.equal(isOpenCall({ status: "Open", done: false }), true);
assert.equal(isClosedCall({ status: "Completed", done: false }), true);
assert.equal(isClosedCall({ status: "Open", done: true }), true);
assert.equal(isOpenCall({ status: "Phone Resolved", done: false }), false);
assert.equal(isOpenPm({ status: "Scheduled", done: false }), true);
assert.equal(isClosedPm({ status: "Cancelled", done: false }), true);
assert.equal(isClosedPm({ status: "Scheduled", done: true }), true);

assert.equal(flagOn(true), true);
assert.equal(flagOn(1), true);
assert.equal(flagOn("t"), true);
assert.equal(flagOn("true"), true);
assert.equal(flagOn("1"), true);
assert.equal(flagOn(false), false);
assert.equal(flagOn(0), false);

assert.equal(normalizeName("  Bill  McKinsley "), "bill mckinsley");
assert.equal(normalizeName("O’Brien"), "obrien");

assert.equal(isoDay("2026-09-22T12:00:00Z"), "2026-09-22");
assert.equal(isoDay(""), "");
assert.equal(isoDayOrNull(""), null);
assert.equal(isoDayOrNull("2026-08-01"), "2026-08-01");
assert.equal(diffDays("2026-09-01", "2026-09-03"), 2);

const mine = mineByTechnician(
  [{ technician: "Ryan Gloria" }, { technician: "Oliver Garcia" }, { technician: null }],
  { filterMine: true, role: "service", matchMine: (...n) => n.includes("Ryan Gloria") },
);
assert.deepEqual(
  mine.map((r) => r.technician),
  ["Ryan Gloria", null],
);
assert.equal(
  mineByTechnician([{ technician: "Oliver Garcia" }], {
    filterMine: true,
    role: "sales",
    matchMine: () => false,
  }).length,
  1,
);

const flagSrc = [
  readFileSync(new URL("../src/lib/ops/access.ts", import.meta.url), "utf8"),
  readFileSync(new URL("../src/lib/ops/reps.ts", import.meta.url), "utf8"),
  readFileSync(new URL("../src/lib/ops/roster.ts", import.meta.url), "utf8"),
].join("\n");
assert.doesNotMatch(flagSrc, /function flagOn\(/);
assert.match(flagSrc, /from "\.\/flag"|from "@\/lib\/ops\/flag"/);

console.log("ssot helpers ok");
