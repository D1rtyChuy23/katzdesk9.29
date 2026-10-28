/**
 * Import Photo Research (Grok's request through Chuy, 10/28): rows of researched part photos from a CSV, so a batch
 * no longer needs a migration (0070 loaded the first one). The import only adds `part_photo_research` rows; photos
 * still go onto parts only through Pull Confirmed Photos. This file is the plain part: reading the file, the key, the
 * address checks and the plan. part-photo-research-api.ts reads and writes the database.
 */

export const RESEARCH_MAX_ROWS = 500;

/** Case, spaces and punctuation removed: the key Parts and the photo route match a part's MPN or SKU on. */
export function mpnKey(s: string | null | undefined): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * An https address on a named public host, or null. The server fetches a research photo when it's pulled, and the
 * review shows the source page as a link: no other scheme, no address by IP, no localhost or private names.
 */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text || text.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.startsWith("[") || IPV4.test(host)) return null;
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
  return url.toString();
}

/** "partstown.com" from "https://www.partstown.com/…". */
export function siteOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export type ResearchRow = {
  /** Line in the file, counting the header as 1. */
  line: number;
  key: string;
  partNumber: string | null;
  imageUrl: string | null;
  sourcePage: string | null;
  verdict: string;
  notes: string | null;
};

const COLUMN: Record<string, keyof Omit<ResearchRow, "line">> = {
  mpnkey: "key",
  partnumber: "partNumber",
  imageurl: "imageUrl",
  sourcepage: "sourcePage",
  status: "verdict",
  notes: "notes",
};
const head = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
const cell = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t ? t : null;
};

/**
 * The rows under the header: mpn_key, part_number, image_url, source_page, status, notes, in any order, written with
 * spaces or underscores. The key is the file's mpn_key, else its part_number, with case and punctuation removed.
 */
export function researchRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): { rows: ResearchRow[] } {
  for (const sheet of sheets) {
    const at = sheet.matrix.slice(0, 10).findIndex((r) => Array.isArray(r) && r.some((v) => COLUMN[head(v)]));
    if (at < 0) continue;
    const cols = new Map<number, keyof Omit<ResearchRow, "line">>();
    (sheet.matrix[at] as unknown[]).forEach((v, i) => {
      const k = COLUMN[head(v)];
      if (k && ![...cols.values()].includes(k)) cols.set(i, k);
    });
    const has = (k: keyof Omit<ResearchRow, "line">) => [...cols.values()].includes(k);
    if (!(has("key") || has("partNumber")) || !has("imageUrl") || !has("verdict")) {
      throw new Error("The file needs the columns mpn_key (or part_number), image_url and status.");
    }
    const rows: ResearchRow[] = [];
    sheet.matrix.slice(at + 1).forEach((r, i) => {
      if (!Array.isArray(r) || !r.some((v) => cell(v))) return;
      const get = (k: keyof Omit<ResearchRow, "line">) => {
        for (const [c, name] of cols) if (name === k) return cell(r[c]);
        return null;
      };
      const partNumber = get("partNumber");
      rows.push({
        line: at + i + 2,
        key: mpnKey(get("key") ?? partNumber),
        partNumber,
        imageUrl: get("imageUrl"),
        sourcePage: get("sourcePage"),
        verdict: (get("verdict") ?? "").toLowerCase(),
        notes: get("notes"),
      });
    });
    return { rows };
  }
  throw new Error("The file needs the columns mpn_key (or part_number), image_url and status.");
}

/** A part on the list, with the two keys it can be found by. */
export type ResearchPart = { id: number; sku: string; description: string | null; mfrPart: string | null; hasPhoto: boolean; mpnKey: string; skuKey: string };

export type ResearchPlanStatus = "add" | "duplicate" | "no_match" | "bad_url" | "bad_status" | "no_key";

export type ResearchPlanLine = ResearchRow & {
  status: ResearchPlanStatus;
  /** Why it's skipped, in a few words. */
  reason: string | null;
  /** The part the key finds (its MPN before its SKU), whatever the status. */
  part: { id: number; sku: string; description: string | null; mfrPart: string | null } | null;
  hasPhoto: boolean;
  /** The part already has a research row (under this key or its other one). */
  researched: boolean;
  /** The checked addresses that go in. */
  image: string | null;
  page: string | null;
};

/**
 * What each row would do. Skipped: no key; a status other than confirmed or review; a bad address (an image or source
 * page that isn't https on a public host, or a confirmed row with no image); and a key no part has. Also skipped as a
 * duplicate, so research on file is never replaced: a key already researched; a part that already has research under
 * its other number (Parts reads a part's research by its MPN, else its SKU, so a new row under the MPN would take over
 * from one under the SKU); and a key or a part already earlier in the file. The rest are added.
 */
export function planResearch(rows: ResearchRow[], parts: ResearchPart[], researchedKeys: Set<string>): ResearchPlanLine[] {
  const byKey = new Map<string, ResearchPart>();
  // A part found by its MPN wins over one found by its SKU, as the photo route orders them.
  for (const p of parts) if (p.skuKey && !byKey.has(p.skuKey)) byKey.set(p.skuKey, p);
  for (const p of [...parts].reverse()) if (p.mpnKey) byKey.set(p.mpnKey, p);
  const hasResearch = (p: ResearchPart) => (!!p.mpnKey && researchedKeys.has(p.mpnKey)) || (!!p.skuKey && researchedKeys.has(p.skuKey));
  const seen = new Set<string>();
  const seenParts = new Set<number>();
  return rows.map((r) => {
    const p = r.key ? (byKey.get(r.key) ?? null) : null;
    // Every part this key reaches: the one shown, and any other with the same number as its MPN or SKU.
    const reached = r.key ? parts.filter((q) => q.mpnKey === r.key || q.skuKey === r.key) : [];
    const image = safeHttpsUrl(r.imageUrl);
    const page = safeHttpsUrl(r.sourcePage);
    const base = {
      ...r,
      part: p ? { id: p.id, sku: p.sku, description: p.description, mfrPart: p.mfrPart } : null,
      hasPhoto: !!p?.hasPhoto,
      researched: !!p && hasResearch(p),
      image,
      page,
    };
    const line = (status: ResearchPlanStatus, reason: string | null): ResearchPlanLine => ({ ...base, status, reason });
    if (!r.key) return line("no_key", "No mpn_key or part_number");
    if (r.verdict !== "confirmed" && r.verdict !== "review") return line("bad_status", `Status "${r.verdict || "blank"}": confirmed or review`);
    if (r.imageUrl && !image) return line("bad_url", "The image address isn't https on a public site");
    if (!image && r.verdict === "confirmed") return line("bad_url", "A confirmed row needs an image address");
    if (r.sourcePage && !page) return line("bad_url", "The source page isn't https on a public site");
    if (seen.has(r.key)) return line("duplicate", "Twice in the file: the first one counts");
    seen.add(r.key);
    if (researchedKeys.has(r.key)) return line("duplicate", "Already researched: left as it is");
    if (!p) return line("no_match", "No part has this MPN or SKU");
    const other = reached.find(hasResearch);
    if (other) {
      return line(
        "duplicate",
        other.id === p.id ? "Already researched under the part's other number: left as it is" : `${other.sku} has this number and research already: left as it is`,
      );
    }
    if (reached.some((q) => seenParts.has(q.id))) return line("duplicate", "The part is already earlier in the file: the first one counts");
    for (const q of reached) seenParts.add(q.id);
    return line("add", null);
  });
}

export type ResearchCounts = { add: number; duplicate: number; noMatch: number; badUrl: number; badStatus: number; noKey: number };

export function researchCounts(plan: ResearchPlanLine[]): ResearchCounts {
  const n = (s: ResearchPlanStatus) => plan.filter((l) => l.status === s).length;
  return { add: n("add"), duplicate: n("duplicate"), noMatch: n("no_match"), badUrl: n("bad_url"), badStatus: n("bad_status"), noKey: n("no_key") };
}
