// Writes docs/state-machines.md from the registry: npm run docs:states
import { writeFileSync } from "node:fs";
import { register } from "node:module";

await register("./node-resolve-hook.mjs", import.meta.url);
const { renderStateMachinesDoc } = await import("../src/lib/ops/state-machines.ts");
writeFileSync(new URL("../docs/state-machines.md", import.meta.url), renderStateMachinesDoc());
console.log("wrote docs/state-machines.md");
