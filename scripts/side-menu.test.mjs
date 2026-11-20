// The side menu's layout (Chuy, 11/14): pages grouped by the work they do, each cleanup tool beside the data it fixes,
// and Parts renamed Item Catalog. Each role keeps what it saw before; the pages new to the menu are hidden from the
// roles that don't use them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { menuFor, SIDE_MENU, WAREHOUSE_PAGES } from "../src/lib/ops/side-menu.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const shape = (groups) => groups.map((g) => [g.label, g.items.map((i) => i.label)]);

const OWNER = [
  ["", ["Coming Due", "Planner"]],
  ["Accounts", ["Customers", "Map", "Address Report", "Recipes", "Clean Names"]],
  ["Sales & Installs", ["Pipeline", "Install Board", "Handoff"]],
  ["Service", ["Tickets", "PMs", "TLC + Factor", "Runbook Readiness", "Out Of Network"]],
  ["Assets", ["Equipment", "Equipment Mismatches", "Barn Warehouse", "Locations", "Modules"]],
  ["Shop", ["Rebuilds", "Item Catalog", "The Library"]],
  ["Billing & Reports", ["Invoices", "Analytics"]],
  ["Admin", ["Settings", "Access"]],
];

test("the owner sees every group in work order", () => {
  assert.deepEqual(shape(menuFor(null, true)), OWNER);
  assert.deepEqual(shape(menuFor("admin", true)), OWNER);
});

test("the Admin role sees everything, Access too (11/20)", () => {
  assert.deepEqual(shape(menuFor("admin", false)), OWNER);
});

test("the Service role: no Clean Names, no Invoices, no Access", () => {
  const service = OWNER.map(([g, items]) => [g, items.filter((l) => !["Clean Names", "Invoices", "Access"].includes(l))]);
  assert.deepEqual(shape(menuFor("service", false)), service);
  assert.deepEqual(shape(menuFor(null, false)), service);
});

test("a sales rep sees Service's lists only, not the planner, the bench, runbooks or outside techs", () => {
  assert.deepEqual(shape(menuFor("sales", false)), [
    ["", ["Coming Due"]],
    ["Accounts", ["Customers", "Map", "Address Report", "Recipes"]],
    ["Sales & Installs", ["Pipeline", "Install Board", "Handoff"]],
    ["Service", ["Tickets", "PMs", "TLC + Factor"]],
    ["Assets", ["Equipment", "Equipment Mismatches", "Barn Warehouse", "Locations", "Modules"]],
    ["Shop", ["Item Catalog", "The Library"]],
    ["Billing & Reports", ["Analytics"]],
    ["Admin", ["Settings"]],
  ]);
  // A sales rep who is also the owner sees it all, as before.
  assert.deepEqual(shape(menuFor("sales", true)), OWNER);
});

test("the Warehouse role sees its seven pages, under Assets and Shop, even as the owner", () => {
  const warehouse = [
    ["Assets", ["Equipment", "Barn Warehouse", "Locations", "Modules"]],
    ["Shop", ["Rebuilds", "Item Catalog", "The Library"]],
  ];
  assert.deepEqual(shape(menuFor("warehouse", false)), warehouse);
  assert.deepEqual(shape(menuFor("warehouse", true)), warehouse);
  assert.deepEqual([...WAREHOUSE_PAGES].sort(), ["/assets", "/library", "/locations", "/modules", "/parts", "/rebuilds", "/warehouse"]);
});

test("every page stays at its address, and each menu link is a real page", () => {
  const to = Object.fromEntries(SIDE_MENU.flatMap((g) => g.items).map((i) => [i.label, i.to]));
  assert.deepEqual(
    [to["Install Board"], to["Item Catalog"], to["Barn Warehouse"], to["Address Report"], to["Equipment Mismatches"], to["Runbook Readiness"], to["Planner"]],
    ["/installs", "/parts", "/warehouse", "/address-report", "/unit-mismatches", "/runbook-readiness", "/planner"],
  );
  const routes = src("src/routeTree.gen.ts");
  for (const path of Object.values(to)) assert.match(routes, new RegExp(`'${path.replace(/\//g, "\\/")}': typeof`), path);
  assert.equal(SIDE_MENU.flatMap((g) => g.items).find((i) => i.to === "/").exact, true);
});

test("the shell draws the menu from menuFor, and guards the Warehouse role with the same pages", () => {
  const shell = src("src/components/desk/shell.tsx");
  assert.match(shell, /const groups = menuFor\(role, isAdmin\);/);
  assert.match(shell, /const allowed = WAREHOUSE_PAGES\.some\(/);
  assert.doesNotMatch(shell, /const NAV:|WAREHOUSE_OK|SALES_SERVICE/);
});

test("the Parts page reads Item Catalog, and its search leads with the MPN", () => {
  const page = src("src/routes/_app/parts.tsx");
  assert.match(page, />Item Catalog<\/h1>/);
  assert.match(page, /The NetSuite item list: parts, filters, service, equipment and dispensers/);
  assert.match(page, /placeholder="Search by MPN, SKU or name…" label="Search the item catalog"/);
});
