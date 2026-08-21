export type DeskSortId =
  | "date-desc"
  | "date-asc"
  | "alpha-asc"
  | "alpha-desc"
  | "equip-desc"
  | "equip-asc"
  | "value-desc"
  | "value-asc"
  | "status"
  | "flag"
  | "tech";

export type DeskSortOption = { id: DeskSortId; label: string };

export const SORT_DATE: DeskSortOption[] = [
  { id: "date-desc", label: "Date · Latest → Oldest" },
  { id: "date-asc", label: "Date · Oldest → Latest" },
];

export const SORT_ALPHA: DeskSortOption[] = [
  { id: "alpha-asc", label: "Name · A → Z" },
  { id: "alpha-desc", label: "Name · Z → A" },
];

export const SORT_EQUIP: DeskSortOption[] = [
  { id: "equip-desc", label: "Equipment · Most → Least" },
  { id: "equip-asc", label: "Equipment · Least → Most" },
];

export const SORT_VALUE: DeskSortOption[] = [
  { id: "value-desc", label: "Deal value · Highest → Lowest" },
  { id: "value-asc", label: "Deal value · Lowest → Highest" },
];

export const SORT_STATUS: DeskSortOption[] = [{ id: "status", label: "Status" }];
export const SORT_FLAG: DeskSortOption[] = [{ id: "flag", label: "Urgency · Flags first" }];
export const SORT_TECH: DeskSortOption[] = [{ id: "tech", label: "Technician" }];

export const SORT_LIST = [...SORT_DATE, ...SORT_ALPHA, ...SORT_EQUIP, ...SORT_STATUS, ...SORT_FLAG, ...SORT_TECH];
export const SORT_DEALS = [...SORT_DATE, ...SORT_ALPHA, ...SORT_EQUIP, ...SORT_VALUE, ...SORT_STATUS];

export function equipmentCount(raw: string | null | undefined, extra = 0): number {
  if (extra > 0) return extra;
  if (!raw?.trim()) return 0;
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines.length;
  const bits = lines[0]!.split(/\s*(?:,|&|\+|\/)\s*/).map((s) => s.trim()).filter(Boolean);
  return Math.max(bits.length, 1);
}

export type SortAccessors<T> = {
  date?: (row: T) => string | null | undefined;
  name?: (row: T) => string | null | undefined;
  equipment?: (row: T) => number | string | null | undefined;
  value?: (row: T) => number | null | undefined;
  status?: (row: T) => string | null | undefined;
  flagRank?: (row: T) => number;
  tech?: (row: T) => string | null | undefined;
};

function str(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function compareEquip(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  desc: boolean,
): number {
  if (typeof a === "string" || typeof b === "string") {
    const n = str(typeof a === "string" ? a : "").localeCompare(str(typeof b === "string" ? b : ""));
    return desc ? -n : n;
  }
  const na = typeof a === "number" ? a : 0;
  const nb = typeof b === "number" ? b : 0;
  return desc ? nb - na : na - nb;
}

export function compareDesk<T>(a: T, b: T, sort: DeskSortId, get: SortAccessors<T>): number {
  const dateA = str(get.date?.(a));
  const dateB = str(get.date?.(b));
  const nameA = str(get.name?.(a));
  const nameB = str(get.name?.(b));
  const eqRawA = get.equipment?.(a);
  const eqRawB = get.equipment?.(b);
  const nameASafe = nameA;
  const nameBSafe = nameB;
  const valA = get.value?.(a) ?? 0;
  const valB = get.value?.(b) ?? 0;
  const stA = str(get.status?.(a));
  const stB = str(get.status?.(b));
  const flA = get.flagRank?.(a) ?? 99;
  const flB = get.flagRank?.(b) ?? 99;
  const techA = str(get.tech?.(a));
  const techB = str(get.tech?.(b));
  let n = 0;
  switch (sort) {
    case "date-desc":
      n = (dateB || "0000").localeCompare(dateA || "0000") || nameASafe.localeCompare(nameBSafe);
      break;
    case "date-asc":
      n = (dateA || "9999").localeCompare(dateB || "9999") || nameASafe.localeCompare(nameBSafe);
      break;
    case "alpha-asc":
      n = nameASafe.localeCompare(nameBSafe);
      break;
    case "alpha-desc":
      n = nameBSafe.localeCompare(nameASafe);
      break;
    case "equip-desc":
      n = compareEquip(eqRawA, eqRawB, true) || nameASafe.localeCompare(nameBSafe);
      break;
    case "equip-asc":
      n = compareEquip(eqRawA, eqRawB, false) || nameASafe.localeCompare(nameBSafe);
      break;
    case "value-desc":
      n = valB - valA || nameASafe.localeCompare(nameBSafe);
      break;
    case "value-asc":
      n = valA - valB || nameASafe.localeCompare(nameBSafe);
      break;
    case "status":
      n = stA.localeCompare(stB) || nameASafe.localeCompare(nameBSafe);
      break;
    case "flag":
      n = flA - flB || dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
      break;
    case "tech":
      n = techA.localeCompare(techB) || nameA.localeCompare(nameB);
      break;
    default:
      n = nameA.localeCompare(nameB);
  }
  return n;
}

export function sortDesk<T>(rows: T[], sort: DeskSortId, get: SortAccessors<T>): T[] {
  return [...rows].sort((a, b) => compareDesk(a, b, sort, get));
}

export function tally<T>(rows: T[], key: (row: T) => string | null | undefined): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = (key(row) ?? "").trim() || "Unspecified";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
