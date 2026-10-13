import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { loadRates } from "./calc.mjs";
import { renderGuidePdf } from "./render.mjs";

const root = new URL("../../pm-guides/", import.meta.url);
const id = process.argv[2];
const dataPath = id && new URL(`data/${id}.json`, root);

if (!id || !existsSync(dataPath)) {
  console.error(`Unknown machine "${id ?? ""}". Add pm-guides/data/<machine-id>.json first.`);
  process.exit(1);
}

mkdirSync(new URL("out/", root), { recursive: true });
const out = process.argv[3] ?? new URL(`out/${id}.pdf`, root).pathname;
await renderGuidePdf(JSON.parse(readFileSync(dataPath, "utf8")), loadRates(), out);
console.log(`Wrote ${out}`);
