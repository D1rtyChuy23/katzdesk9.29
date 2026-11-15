// The Library keeps your place (Chuy, 11/14): picking a maker, model, variation or spec sheet no longer jumps to the
// top, what you opened scrolls into view, and the manufacturer cards fold to the one you're in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/routes/_app/library.tsx", import.meta.url), "utf8");

test("in-page picks keep the scroll: every navigate to the Library but the tab switch keeps its place", () => {
  assert.match(page, /const go = \(s: Search\) => void navigate\(\{ to: "\/library", search: \{ \.\.\.s, tab: s\.tab \?\? \(tab === "library" \? undefined : tab\) \}, resetScroll: false \}\);/);
  for (const call of page.match(/navigate\(\{ to: "\/library", search: \{ book: [^}]*\}[^)]*\)/g) ?? []) assert.match(call, /resetScroll: false/, call);
});

test("what you opened scrolls to the top of the screen: a spec sheet, else the model; closing a sheet doesn't move the page", () => {
  assert.match(page, /const sheetPanel = useRef<HTMLDivElement>\(null\);/);
  // The phone's header is taller (logo row plus search), so what opens stops below it there too.
  assert.match(page, /<div ref=\{sheetPanel\} className="mt-4 scroll-mt-32 sm:scroll-mt-24" data-testid="book-spec-sheet">/);
  assert.match(page, /className="mt-4 scroll-mt-32 rounded-xl [^"]* sm:scroll-mt-24" aria-label=\{current\.title\} data-testid="open-book"/);
  assert.match(page, /if \(opened && sheetPanel\.current\) sheetPanel\.current\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\);/);
  assert.match(page, /else if \(moved && bookPanel\.current\) bookPanel\.current\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\);/);
  assert.doesNotMatch(page, /block: "nearest"/);
});

test("a picked manufacturer folds the cards to its own, with All manufacturers to see them again", () => {
  assert.match(page, /const [[]allMakers, setAllMakers[\]] = useState\(false\);/);
  assert.match(page, /const makerCards = activeMaker && !allMakers \? \[activeMaker\] : makers;/);
  assert.match(page, /\{makerCards\.map\(\(maker\) => \{/);
  assert.match(page, /data-testid="library-all-makers"/);
  assert.match(page, /All manufacturers · \{makers\.length\}/);
});

test("Back to another model opens its own maker: the address's model wins over the maker last clicked", () => {
  assert.match(page, /useEffect\(\(\) => \{\n    if \(bookParam != null\) setOpenMaker\(null\);\n  \}, \[bookParam\]\);/);
});
