// Lets node:test load `@/` and extensionless TypeScript imports the same way the app does.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

function withExt(fileUrl) {
  const path = fileURLToPath(fileUrl);
  if (existsSync(path)) return fileUrl;
  for (const ext of [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"]) {
    if (existsSync(path + ext)) return pathToFileURL(path + ext).href;
  }
  return fileUrl;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
    return nextResolve(withExt(url.href), context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.includes("/src/")) {
    const url = new URL(specifier, context.parentURL);
    return nextResolve(withExt(url.href), context);
  }
  return nextResolve(specifier, context);
}
