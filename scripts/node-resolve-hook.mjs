import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

function fileFor(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.mjs`, `${base}.js`, `${base}.json`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`];
  return candidates.find((p) => {
    try {
      return existsSync(p) && statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

/** Lets a node --test file import the app's `@/` and extensionless TypeScript. */
export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith("@/")) base = new URL("../src/" + specifier.slice(2), import.meta.url).pathname;
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) base = fileURLToPath(new URL(specifier, context.parentURL));
  if (base) {
    const hit = fileFor(base);
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    return { format: "module", shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), "utf8")}` };
  }
  return nextLoad(url, context);
}
