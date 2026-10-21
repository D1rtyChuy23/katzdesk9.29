import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const root = fileURLToPath(new URL("..", import.meta.url));
const committedPath = path.join(root, "src/routeTree.gen.ts");

/** What the router plugin writes for the route files as they are now (dev and build both regenerate the tree). */
async function generatedTree() {
  const committed = readFileSync(committedPath, "utf8");
  const footer = committed.slice(committed.indexOf("import type { getRouter }")).trimEnd();
  const out = mkdtempSync(path.join(tmpdir(), "route-tree-"));
  try {
    const config = getConfig(
      {
        routesDirectory: path.join(root, "src/routes"),
        generatedRouteTree: path.join(out, "routeTree.gen.ts"),
        tmpDir: out,
        disableLogging: true,
        routeTreeFileFooter: [footer],
      },
      root,
    );
    await new Generator({ config, root }).run();
    const tree = readFileSync(path.join(out, "routeTree.gen.ts"), "utf8");
    // Written outside src/, so its imports point back at src/routes; the committed file imports "./routes/...".
    return { committed, tree: tree.replace(/from '[^']*\/src\/routes\//g, "from './routes/") };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

test("the printed install form is its own page under the app layout, not inside the Installs board", async () => {
  const { tree } = await generatedTree();
  const print = tree.match(/const AppInstallsInstallIdPrintRoute =[\s\S]*?\} as any\)/)?.[0] ?? "";
  assert.ok(print, "the print route is in the tree");
  // The Installs board renders no <Outlet/>, so a page nested under it shows the board instead of the form.
  assert.match(print, /getParentRoute: \(\) => AppRoute,/);
  assert.match(print, /path: '\/installs\/\$installId\/print'/);
});

test("the committed route tree is what the router plugin generates", async () => {
  const { committed, tree } = await generatedTree();
  assert.equal(committed, tree);
});
