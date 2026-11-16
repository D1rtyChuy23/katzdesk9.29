// Quick fixes from the 11/16 pass (Chuy: "Go"): an open tab hears about a new version, a wrong address gets a real
// page, three silent saves say when they fail, and fields and icon buttons carry names a screen reader can say.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { newerBuildLive } = await import("../src/lib/ops/version-notice.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a new version is announced only when both builds are real commits and they differ", () => {
  const a = "a8114b208ed78cc0df55e73f14f75d31cf13309e";
  const b = "27f43b86fbb3401f459158e0688466237a7250dd";
  assert.equal(newerBuildLive(a, b), true);
  assert.equal(newerBuildLive(a, a), false);
  assert.equal(newerBuildLive(a, a.slice(0, 7)), false, "a short and a full sha of one commit");
  for (const [mine, live] of [["dev", b], [a, "dev"], [a, "unknown"], ["unknown", b], [a, ""], [a, null], [a, undefined]]) assert.equal(newerBuildLive(mine, live), false, `${mine} / ${live}`);
  const notice = src("src/components/desk/version-notice.tsx");
  assert.match(notice, /A new version of KatzDesk is live\./);
  assert.match(notice, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.match(notice, /meta: \{ quietErrors: true \}/);
  assert.match(src("src/routes/_app.tsx"), /<VersionNotice \/>/);
});

test("a wrong address gets a page with a way back", () => {
  assert.match(src("src/router.tsx"), /defaultNotFoundComponent: AppNotFoundComponent/);
  const page = src("src/lib/error-component.tsx");
  assert.match(page, /export function AppNotFoundComponent\(\)/);
  assert.match(page, /Page Not Found/);
  assert.match(page, /href="\/"/);
  // A block, not a second <main>: it also shows inside the app's page area.
  assert.doesNotMatch(page.slice(page.indexOf("export function AppNotFoundComponent")), /<main/);
});

test("fields and icon buttons carry a name a screen reader can say", () => {
  const planner = src("src/components/desk/rebuild-planner.tsx");
  assert.match(planner, /aria-label="Previous week"/);
  assert.match(planner, /aria-label="Next week"/);
  assert.match(planner, /aria-label="Health"/);
  assert.match(planner, /aria-label=\{`Target date for \$\{r\.title\}`\}/);
  const charges = src("src/components/desk/charges-panel.tsx");
  // The name starts with the word on screen ("Qty"), so voice control finds it by what it shows.
  assert.match(charges, /aria-label=\{`Qty, line \$\{i \+ 1\}`\}/);
  assert.match(charges, /aria-label=\{`Rate, line \$\{i \+ 1\}`\}/);
  assert.match(src("src/components/desk/reps-editor.tsx"), /aria-label="Rep's full name"/);
});

test("the three saves that failed silently now say so", () => {
  const admin = src("src/components/desk/library-admin.tsx");
  assert.match(admin, /onError: \(e\) => fail\(e, "Could not save that as done"\)/);
  assert.match(admin, /onError: \(e\) => fail\(e, "Could not save the section's open state"\)/);
  assert.match(src("src/components/desk/notify-bell.tsx"), /onError: \(e\) => toast\.error\(e instanceof Error \? e\.message : "Could not mark that as read"\)/);
});
