import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { describeLoadError, isExpectedRefusal, loadProblemReport, notLoadedText, nounForQueryKey, shownCount } from "../src/lib/ops/load-problem.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a failed load is named: signed out, offline, or the server's own message", () => {
  assert.deepEqual(describeLoadError(new Error("Unauthorized")), { kind: "signed-out", message: "Unauthorized" });
  assert.equal(describeLoadError(new TypeError("Failed to fetch")).kind, "offline");
  assert.deepEqual(describeLoadError(new Error('relation "install_work_orders" does not exist')), {
    kind: "server",
    message: 'relation "install_work_orders" does not exist',
  });
  assert.equal(describeLoadError(undefined).message, "Unknown error");
});

test("expected refusals don't raise the banner; real failures do", () => {
  assert.equal(isExpectedRefusal("Only Service and Admin can stack or unstack a PM."), true);
  assert.equal(isExpectedRefusal('relation "install_work_orders" does not exist'), false);
});

test("plain names, dashes instead of fake zeros, and the copied report", () => {
  assert.equal(nounForQueryKey(["installs"]), "installs");
  assert.equal(nounForQueryKey(["pms"]), "PMs");
  assert.equal(nounForQueryKey(["spec-reads", 3]), "spec reads");
  assert.equal(shownCount(false, 0), "—");
  assert.equal(shownCount(true, 0), 0);
  assert.equal(notLoadedText({ isSuccess: false, isError: true }, "installs"), "The installs list didn't load. See the message above.");
  assert.equal(notLoadedText({ isSuccess: false, isError: false }, "installs"), "Loading installs…");
  assert.equal(notLoadedText({ isSuccess: true, isError: false }, "installs"), null);
  assert.equal(
    loadProblemReport("/installs?open=135", [{ noun: "installs", message: "boom" }], "10/22/2026, 9:00 PM"),
    "Katz Desk load problem · 10/22/2026, 9:00 PM\nPage: /installs?open=135\nCouldn't load installs: boom",
  );
});

test("every page shows the banner, and stat rows and empty spots wait for their data", () => {
  assert.match(src("src/routes/_app.tsx"), /<LoadProblems \/>\s*<Outlet \/>/);
  for (const [file, q] of [
    ["src/components/desk/jobs-page.tsx", "jobs"],
    ["src/routes/_app/pipeline.tsx", "data"],
    ["src/routes/_app/pms.tsx", "pms"],
    ["src/routes/_app/modules.tsx", "data"],
    ["src/routes/_app/rebuilds.tsx", "data"],
    ["src/routes/_app/warehouse.tsx", "data"],
    ["src/routes/_app/locations.tsx", "data"],
    ["src/routes/_app/analytics.tsx", "view"],
  ]) {
    assert.ok(!/<StatRow>/.test(src(file)), `${file} has a StatRow without loaded`);
    assert.match(src(file), new RegExp(`<StatRow loaded=\\{${q}\\.isSuccess\\}>`), file);
  }
  const installs = src("src/routes/_app/installs.tsx");
  assert.match(installs, /Prep \(\{shownCount\(loaded, prepN\)\}\)/);
  assert.match(installs, /Couldn't open install #\$\{open\}: the installs list didn't load\./);
  assert.match(src("src/components/desk/desk-charts.tsx"), /if \(!loaded\) \{\s*value = "—";/);
});
