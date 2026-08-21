#!/usr/bin/env node
/**
 * Nitro traces PGLite's JS but not the sidecar wasm/data files it loads via
 * `new URL("./pglite.data", import.meta.url)`. Preview (no DATABASE_URL) needs
 * those files next to the bundled module. Deployed Vercel uses Neon instead.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const destDir = join(root, ".vercel/output/functions/__server.func/_libs");

if (!existsSync(destDir)) {
  console.warn("[pglite-wasm] skip — vercel function output not found");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const from = join(srcDir, name);
  if (!existsSync(from)) {
    console.error(`[pglite-wasm] missing ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(destDir, name));
}
console.log("[pglite-wasm] copied wasm/data next to electric-sql__pglite.mjs");
