// The version line on Settings (Chuy, 11/13): which build is running, so a tester can check the deploy.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
const B = await import("../src/lib/build-info.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the build line: the commit's first 7 characters and the Chicago build time; dev outside a build", () => {
  assert.equal(B.shortSha("60C5DBD8E12A2F5C5975AE76B3ED6A04C97381B2"), "60c5dbd");
  assert.equal(B.shortSha("unknown"), "unknown");
  assert.equal(B.buildLine({ sha: "60c5dbd8e12a2f5c5975ae76b3ed6a04c97381b2", builtAt: "2026-11-13T07:18:38Z" }), "Build 60c5dbd · built Nov 13, 2026, 1:18 AM");
  assert.equal(B.buildLine({ sha: "dev", builtAt: "" }), "Build dev");
  assert.equal(B.BUILD.sha, "dev", "node --test has no Vite define");
});

test("Vite sets the build from Vercel's commit, else git; Settings shows it", () => {
  const cfg = src("vite.config.ts");
  assert.ok(cfg.includes("process.env.VERCEL_GIT_COMMIT_SHA"));
  assert.ok(cfg.indexOf("process.env.KATZ_BUILD_SHA") < cfg.indexOf("process.env.VERCEL_GIT_COMMIT_SHA"), "a passed commit wins (11/13: the CLI publish had no git)");
  assert.ok(cfg.includes('execSync("git rev-parse HEAD"'));
  assert.ok(cfg.includes("__KATZ_BUILD__: JSON.stringify("));
  assert.ok(src("src/routes/_app/settings.tsx").includes('data-testid="settings-build"'));
});
