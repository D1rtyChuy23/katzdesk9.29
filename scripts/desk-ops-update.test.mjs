import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const exportSrc = readFileSync(new URL("../src/lib/ops/export-reports.ts", import.meta.url), "utf8");
assert.ok(exportSrc.includes('"Serial number"'), "readiness export must have Serial number column");
assert.ok(exportSrc.includes('"Electrical configuration"'), "readiness export must have Electrical configuration column");
assert.ok(exportSrc.includes('"Configuration"'), "keep Configuration column");
assert.match(exportSrc, /name: "Not ready"/);
assert.match(exportSrc, /name: "Ready"/);

const corrigo = readFileSync(new URL("../src/components/desk/corrigo-import.tsx", import.meta.url), "utf8");
assert.ok(corrigo.includes("Add customer"), "import preview must offer Add customer");
assert.ok(corrigo.includes("allowCreate={false}"), "must not auto-create from combo +");
assert.ok(corrigo.includes("addDirectoryEntry"), "create only after Add");

const installs = readFileSync(new URL("../src/routes/_app/installs.tsx", import.meta.url), "utf8");
assert.ok(installs.includes("Mark installed"));
assert.ok(installs.includes("installedPatch"));
assert.ok(installs.includes("isOpenInstall"));
assert.ok(installs.includes("isInstalled"));

const planner = readFileSync(new URL("../src/components/desk/planner-calendar.tsx", import.meta.url), "utf8");
assert.ok(planner.includes("cal-type-"));
assert.ok(planner.includes('"installs"'));
assert.ok(planner.includes('"pms"'));
assert.ok(planner.includes('"tlcs"'));
assert.ok(planner.includes('"services"'));
assert.ok(planner.includes("cal-type-all"));

console.log("desk ops update source checks ok");
