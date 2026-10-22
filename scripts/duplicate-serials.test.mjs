import assert from "node:assert/strict";
import { test } from "node:test";
import { dupKey, findDuplicateSerials, looseKey } from "../src/lib/ops/duplicate-serials.ts";

const empty = { units: [], installs: [], assets: [], modules: [] };
const sheet = (sheets, name) => sheets.find((s) => s.name === name);
const unit = (id, customer, serial, name = "Bunn TB3") => ({ id, customer, name, serial, installDate: null, locked: false });

test("keys: the desk's serial key, blanks and N/A ignored; near matches drop dashes, SN and leading zeros", () => {
  assert.equal(dupKey(" ITCB 064919 "), "itcb064919");
  assert.equal(dupKey("N/A"), "");
  assert.equal(dupKey("12"), "");
  assert.equal(looseKey("SN: 0ITCB-064919"), "ITCB064919");
  assert.equal(looseKey("itcb.064919"), "ITCB064919");
});

test("account units: same account says Merge; different accounts says pick the right one", () => {
  const sheets = findDuplicateSerials({
    ...empty,
    units: [unit(1, "Sweet", "AX-100"), unit(2, "Sweet", "ax-100 "), unit(3, "Shirley's Donut", "TB-500"), unit(4, "Sweet", "TB-500"), unit(5, "Solo", "ZZ-999")],
  });
  const rows = sheet(sheets, "Account units").rows;
  assert.deepEqual(rows.map((r) => r[3]), ["1", "2", "3", "4"]);
  assert.match(rows[0][6], /Merge it on the account's Equipment tab/);
  assert.match(rows[2][6], /On 2 accounts/);
});

test("install lists: twice on one install, two installs for one account, installs for two accounts", () => {
  const inst = (id, customer, rows, installed = false) => ({ id, customer, installed, rows: rows.map(([equipment, serial]) => ({ equipment, serial })) });
  const sheets = findDuplicateSerials({
    ...empty,
    installs: [
      inst(13, "Shirley's Donut", [["Bunn Axiom-APS", "AXAP049095"]]),
      inst(18, "Sweet", [["Bunn Axiom-APS", "AXAP049095"]], true),
      inst(20, "Twice Cafe", [["Bunn TB3", "TB-111"], ["Bunn TB3", "TB-111"]]),
      inst(21, "Split Cafe", [["Fetco 52H", "F-101"]]),
      inst(22, "Split Cafe", [["Fetco 52H", "F-101"]]),
      inst(23, "Clean Cafe", [["Fetco 52H", ""], ["Bunn TB3", ""]]),
    ],
  });
  const rows = sheet(sheets, "Install lists").rows;
  assert.deepEqual(rows.map((r) => [r[1], r[4]]), [["#13", "Open"], ["#18", "Installed"], ["#20", "Open"], ["#20", "Open"], ["#21", "Open"], ["#22", "Open"]]);
  assert.match(rows[0][5], /installs for 2 accounts/);
  assert.match(rows[2][5], /Listed twice on this install/);
  assert.match(rows[4][5], /2 installs for this account/);
});

test("warehouse duplicates, and the barn and an account claiming one machine", () => {
  const asset = (id, serial, status, soldTo = null) => ({ id, model: "Bunn ITB-DD", serial, status, site: status === "ready" ? "barn-back" : null, soldTo });
  const sheets = findDuplicateSerials({
    ...empty,
    units: [unit(1, "Local Foods - ATX #2", "ITB0065194", "Bunn ITB-DD"), unit(2, "Right Cafe", "ITB0099999", "Bunn ITB-DD"), unit(3, "Same Cafe", "ITB0011111")],
    assets: [asset(10, "ITB0065194", "ready"), asset(11, "ITB0099999", "deployed", "Wrong Cafe"), asset(12, "ITB0011111", "deployed", "Same Cafe"), asset(13, "W-777", "ready"), asset(14, "w-777", "deployed")],
  });
  assert.deepEqual(sheet(sheets, "Warehouse").rows.map((r) => r[1]), ["13", "14"]);
  const cross = sheet(sheets, "Warehouse vs accounts").rows;
  assert.equal(cross.length, 2);
  assert.match(cross[0][7], /Ready in the barn and on Local Foods - ATX #2's equipment/);
  assert.match(cross[1][7], /The warehouse says Wrong Cafe; the account list says Right Cafe/);
});

test("modules and near matches; the Account filter keeps groups that touch that account", () => {
  const sheets = findDuplicateSerials({
    ...empty,
    units: [unit(1, "Dash Cafe", "ITCB-064919"), unit(2, "Other Cafe", "Q-123")],
    installs: [{ id: 30, customer: "Dash Cafe", installed: false, rows: [{ equipment: "Bunn ITCB", serial: "ITCB064919" }] }],
    modules: [
      { id: 1, moduleId: "BM-1001", platform: "Cameo", type: "Brew Module", status: "Ready", customer: null },
      { id: 2, moduleId: "BM-1001", platform: "Cameo", type: "Brew Module", status: "Installed at Account", customer: "Dash Cafe" },
    ],
  });
  assert.deepEqual(sheet(sheets, "Near matches").rows.map((r) => r[1]), ["Account unit 1", "Install #30"]);
  assert.equal(sheet(sheets, "Modules").rows.length, 2);
  const filtered = findDuplicateSerials({ ...empty, units: [unit(1, "Sweet", "AX-100"), unit(2, "Sweet", "AX-100"), unit(3, "Elsewhere", "B-200"), unit(4, "Elsewhere", "B-200")] }, { customer: "swe" });
  assert.deepEqual(sheet(filtered, "Account units").rows.map((r) => r[1]), ["Sweet", "Sweet"]);
});

test("the report is on the Export dialog's list as Duplicate serials", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/lib/ops/export-reports.ts", import.meta.url), "utf8");
  assert.match(src, /REPORT_TYPES = \[[^\]]*"serials"/);
  assert.match(src, /serials: "Duplicate serials"/);
  assert.match(src, /else if \(type === "serials"\) sheets = await buildSerials\(/);
});
