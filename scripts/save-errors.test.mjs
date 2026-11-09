import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";

// A save that fails must say so (Chuy, 11/9). Every useMutation in the app has an onError, or is listed here
// with why it doesn't need one.

const QUIET = {
  "src/components/desk/photos-panel.tsx:add": "awaited in a try/catch that reports each photo",
  "src/components/desk/notify-bell.tsx:mark": "marks a notice read; the list is read again either way",
  "src/components/desk/library-admin.tsx:done": "remembers a finished Library chore in the background",
  "src/components/desk/library-admin.tsx:setOpen": "remembers which Library section is open",
};

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

test("every save says so when it fails", () => {
  const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
  const silent = [];
  let count = 0;
  for (const path of files(`${root}/src`)) {
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(/const (\w+) = useMutation\(\{/g)) {
      count += 1;
      let i = m.index + m[0].length;
      for (let depth = 1; depth && i < text.length; i += 1) depth += text[i] === "{" ? 1 : text[i] === "}" ? -1 : 0;
      if (!text.slice(m.index, i).includes("onError")) silent.push(`${path.slice(root.length + 1)}:${m[1]}`);
    }
  }
  assert.ok(count > 200, `found ${count} saves`);
  assert.deepEqual(silent.sort(), Object.keys(QUIET).sort());
});
