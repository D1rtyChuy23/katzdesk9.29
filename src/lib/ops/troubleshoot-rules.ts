/**
 * The Library — Troubleshoot: rules for finding the right manual pages and for refusing anything the
 * stored files do not say. Pure: no DOM, no network — safe for node --test.
 */

export type PageText = { fileId: number; page: number; text: string };

const STOP = new Set(
  "a an and are as at be been but by can cannot could did do does doing for from had has have how i if in into is it its just like may me my no not of off on or our out so some than that the their them then there these they this to too up very was we were what when which while will with wont won't would you your still keeps keep stays stay only also get gets getting got machine unit brewer grinder".split(
    " ",
  ),
);

/** "heating", "heated", "heats", "heater" → "heat"; "leaking" → "leak". Crude on purpose: it only has to match a page. */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 5 && w.endsWith("er")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  // "dose" and "dosing" meet at "dos"; "valve" and "valves" at "valv".
  if (w.length >= 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** The words of an issue that carry meaning, stemmed. Error codes ("E-12", "er4") are kept whole. */
export function issueTerms(issue: string): string[] {
  const out: string[] = [];
  for (const raw of issue.toLowerCase().match(/[a-z0-9][a-z0-9\-']*/g) ?? []) {
    const word = raw.replace(/'s$/, "").replace(/^-+|-+$/g, "");
    if (!word || STOP.has(word)) continue;
    const term = /\d/.test(word) ? word : stem(word);
    if (term.length >= 2 && !out.includes(term)) out.push(term);
  }
  return out;
}

function pageStems(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z0-9][a-z0-9\-']*/g) ?? []) {
    const term = /\d/.test(raw) ? raw : stem(raw);
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

const TROUBLE_WORDS = /troubleshoot|trouble\s?shoot|probable cause|possible cause|remedy|symptom|fault|error code|diagnos/i;

/** How well a page fits the issue: every issue word it holds counts, repeats count a little, a troubleshooting page counts extra. */
export function pageScore(text: string, terms: string[]): number {
  if (!terms.length) return 0;
  const have = pageStems(text);
  let score = 0;
  let hit = 0;
  for (const t of terms) {
    const n = have.get(t) ?? 0;
    if (!n) continue;
    hit++;
    score += 3 + Math.min(n - 1, 3);
  }
  if (!hit) return 0;
  // A page that holds all the words beats one that repeats a single word.
  score += hit === terms.length ? 4 : 0;
  if (TROUBLE_WORDS.test(text)) score += 4;
  return score;
}

/**
 * The pages to read for an issue: best matches first, until the size budget is spent; returned in book order.
 * Pages that hold none of the issue's words are never sent — the files then simply do not cover the issue.
 */
export function pickPages(pages: PageText[], issue: string, budget: number, perPage = 6000): PageText[] {
  const terms = issueTerms(issue);
  const ranked = pages
    .map((p) => ({ p, score: pageScore(p.text, terms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.p.fileId - b.p.fileId || a.p.page - b.p.page);
  const out: PageText[] = [];
  let used = 0;
  for (const { p } of ranked) {
    const text = p.text.length > perPage ? p.text.slice(0, perPage) : p.text;
    if (used + text.length > budget && out.length) break;
    out.push({ ...p, text });
    used += text.length;
  }
  return out.sort((a, b) => a.fileId - b.fileId || a.page - b.page);
}

/**
 * Is a statement actually on the page it cites? At least `need` of its meaningful words must be there.
 * This is what stops an answer that sounds right but is not in the manual.
 */
export function groundedIn(statement: string, pageText: string, need = 0.6): boolean {
  const terms = issueTerms(statement);
  if (!terms.length) return false;
  const have = pageStems(pageText);
  const found = terms.filter((t) => have.has(t)).length;
  return found / terms.length >= need;
}

const squash = (s: string) => s.toLowerCase().replace(/[\s\-–.]+/g, "");

/** A part number is only shown when it is printed on the cited parts-book page. */
export function partNumberOnPage(number: string, pageText: string): boolean {
  const n = squash(number);
  return n.length >= 3 && /\d/.test(n) && squash(pageText).includes(n);
}

/** Two issues are about the same thing when they share most of the shorter one's words. Same variation only — the caller enforces that. */
export function similarIssue(a: string, b: string): boolean {
  const x = issueTerms(a);
  const y = issueTerms(b);
  if (!x.length || !y.length) return false;
  const shared = x.filter((t) => y.includes(t)).length;
  return shared >= 1 && shared / Math.min(x.length, y.length) >= 0.5;
}

/** Said when the files stored on this model do not answer the issue. Nothing fills the gap. */
export const NO_FILE = "No file on this model for this issue.";
/** Said for a part the manual calls for that this variation's parts book does not list. No number is offered from anywhere else. */
export const NOT_IN_PARTS_BOOK = "Not in this model's parts book";

const WET = /\bwater\b|\bdrain(s|age|ing)?\b|\binlet\b|\bfill valve\b|\bplumb/i;
/** Grinders take no water and have no drain: such steps are never shown for them. */
export function dropWetSteps<T extends { text: string }>(items: T[], grinder: boolean): T[] {
  return grinder ? items.filter((i) => !WET.test(i.text)) : items;
}

/** Tag used in the prompt and in the model's answer to say where a line came from: "S12 p3". */
export const pageTag = (p: { fileId: number; page: number }) => `S${p.fileId} p${p.page}`;

/**
 * The lines in the stored files that hold the issue's words — found with no AI, so they can be shown at once.
 * Best line first; a line that names more of the issue's words ranks higher. Nothing here is rewritten.
 */
export function matchingLines(pages: PageText[], issue: string, limit = 8): PageText[] {
  const terms = issueTerms(issue);
  if (!terms.length) return [];
  const hits: { line: PageText; score: number }[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    for (const raw of p.text.split(/\n+/)) {
      const text = raw.replace(/\s+/g, " ").trim();
      if (text.length < 8 || text.length > 400) continue;
      const have = pageStems(text);
      const found = terms.filter((t) => have.has(t)).length;
      if (!found) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ line: { fileId: p.fileId, page: p.page, text }, score: found * 10 + (TROUBLE_WORDS.test(text) ? 2 : 0) + (found === terms.length ? 5 : 0) });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.line.fileId - b.line.fileId || a.line.page - b.line.page).slice(0, limit).map((h) => h.line);
}
