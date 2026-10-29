/**
 * Parts → Export CSV (Grok's request through Chuy, 2026-10-29): one row per part on the Parts page, the hidden ones
 * too, Admin only and read only. By default the whole list; "Filtered only" keeps the class and search the page has.
 * Pure: no server imports, safe for node --test. The server streams the rows (parts-export-api.ts).
 */
import { csvCell } from "./charges.ts";
import { binText } from "./part-bins.ts";
import { partImageUrl } from "./part-images.ts";

/** The columns, in Grok's order. */
export const PARTS_EXPORT_COLUMNS = [
  "id",
  "sku",
  "name",
  "description",
  "manufacturer",
  "mfr_part_number",
  "class",
  "bins",
  "hidden",
  "has_photo",
  "photo_url",
  "merged_into_id",
  "created",
  "updated",
  "wo_part_line_count",
  "ticket_count",
  "equipment_link_count",
] as const;

export type PartExportRow = {
  id: number;
  /** The NetSuite item number. */
  sku: string;
  /** The NetSuite item name ("PARTS : EVER104120"). */
  item: string;
  description: string | null;
  mfrPart: string | null;
  itemClass: string | null;
  binRack: string | null;
  binShelf: string | null;
  binBin: string | null;
  hidden: boolean;
  hasPhoto: boolean;
  /** Changes with the photo; part of its address. */
  imageVersion: string | null;
  /** The part this one was folded into (an import copy or an old number). */
  mergedInto: number | null;
  /** ISO time. */
  updatedAt: string | null;
};

export type PartExportCounts = { woPartLines: number; tickets: number; equipmentLinks: number };

const yesNo = (v: boolean) => (v ? "yes" : "no");

/**
 * One CSV line. `origin` makes the photo's address whole ("https://katzdesk.grok.me"). KatzDesk keeps no maker or
 * date added for a part, so manufacturer and created are blank.
 */
export function partExportLine(p: PartExportRow, counts: PartExportCounts | undefined, origin: string): string {
  const photo = p.hasPhoto ? `${origin.replace(/\/+$/, "")}${partImageUrl(p.id, p.imageVersion)}` : "";
  return [
    p.id,
    p.sku,
    p.item,
    p.description ?? "",
    "",
    p.mfrPart ?? "",
    p.itemClass ?? "",
    binText({ rack: p.binRack, shelf: p.binShelf, bin: p.binBin }) ?? "",
    yesNo(p.hidden),
    yesNo(p.hasPhoto),
    photo,
    p.mergedInto ?? "",
    "",
    p.updatedAt ?? "",
    counts?.woPartLines ?? 0,
    counts?.tickets ?? 0,
    counts?.equipmentLinks ?? 0,
  ]
    .map((c) => csvCell(c))
    .join(",");
}

/** The start of the file: a byte-order mark (so Excel reads UTF-8) and the header line. */
export const PARTS_EXPORT_HEAD = "\uFEFF" + PARTS_EXPORT_COLUMNS.join(",") + "\r\n";

export const partsExportFileName = (day: string) => `kd-parts-${day}.csv`;

export type PartsExportFilter = { filtered: boolean; itemClass: string; q: string };

/** The address bar's choice: the whole list unless filtered=1; class and search apply only then. */
export function parsePartsExportQuery(params: URLSearchParams): PartsExportFilter {
  const filtered = params.get("filtered") === "1";
  const clean = (v: string | null, max: number) => (filtered ? (v ?? "").trim().slice(0, max) : "");
  return { filtered, itemClass: clean(params.get("class"), 120), q: clean(params.get("q"), 120) };
}

/** The download link for a choice, for the Parts page. */
export function partsExportHref(f: { filtered: boolean; itemClass?: string; q?: string }): string {
  if (!f.filtered) return "/api/admin/parts-export";
  const p = new URLSearchParams({ filtered: "1" });
  if (f.itemClass?.trim()) p.set("class", f.itemClass.trim());
  if (f.q?.trim()) p.set("q", f.q.trim());
  return `/api/admin/parts-export?${p.toString()}`;
}
