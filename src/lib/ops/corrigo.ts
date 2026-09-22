/** Corrigo report → KatzDesk tickets. Mapping only — no sales fields. */

import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";

export { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";

export const CORRIGO_STATUS: Record<string, string> = {
  cancelled: "Cancelled",
  canceled: "Cancelled",
  completed: "Completed",
  complete: "Completed",
  unassigned: "Open",
  "needs accepting": "Open",
  "waiting for pickup": "Open",
  "picked up": "Dispatched",
  "en route": "Dispatched",
  enroute: "Dispatched",
  "work started": "In Progress",
  paused: "In Progress",
  "on hold": "Follow-up Needed",
};

const HEADER_KEYS: Record<string, CorrigoCol> = {
  st: "wo",
  "st no": "wo",
  "st number": "wo",
  wo: "wo",
  "wo no": "wo",
  "work order": "wo",
  "work order number": "wo",
  "primary service tech": "technician",
  "primary tech": "technician",
  "service tech": "technician",
  technician: "technician",
  "date time completed": "completedAt",
  "date completed": "completedAt",
  "time completed": "completedAt",
  completed: "completedAt",
  "work done": "workDone",
  "operational status": "status",
  "problem description": "issue",
  problem: "issue",
  "customer name": "customer",
  customer: "customer",
  "p o": "po",
  po: "po",
  "po no": "po",
  "po number": "po",
  "call type": "callType",
  type: "callType",
  "ticket type": "callType",
};

export type CorrigoCol =
  | "wo"
  | "technician"
  | "completedAt"
  | "workDone"
  | "status"
  | "issue"
  | "customer"
  | "po"
  | "callType";

export type CorrigoBoard = "service" | "tlc" | "pm" | "install";

export type CorrigoRecord = {
  rawWo: string;
  matchKey: string;
  canonicalWo: string;
  technician: string | null;
  completedAt: string | null;
  workDone: string | null;
  statusRaw: string | null;
  issue: string | null;
  customer: string | null;
  po: string | null;
  callType: string | null;
};

export type CorrigoHit = {
  board: CorrigoBoard;
  id: number;
  status: string;
  customer: string | null;
  wo: string | null;
  duplicateOf?: number | null;
  done?: boolean;
};

export type CorrigoPreviewRow = {
  wo: string;
  rawWo: string;
  matchKey: string;
  canonicalWo: string;
  matchNote: string | null;
  customer: string | null;
  fileCustomer: string | null;
  existingCustomer: string | null;
  fileWalkIn: boolean;
  action: "update" | "create" | "skip";
  board: CorrigoBoard;
  boardLabel: string | null;
  jobId: number | null;
  oldStatus: string | null;
  newStatus: string;
  statusUnmapped: string | null;
  technician: string | null;
  completedAt: string | null;
  workDone: string | null;
  issue: string | null;
  conflictIds: { board: CorrigoBoard; id: number }[] | null;
  wrapRepeat: boolean;
};

export function normalizeHeader(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[#]+/g, "")
    .replace(/[./]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Remaining identity after stripping WO/ST prefixes, spaces, and hyphens. */
export function woCore(raw: string): string {
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  s = s.replace(/[\u2010-\u2015\u2212]/g, "-");
  s = s.replace(/[\u00a0\u202f\u2007\u2009]/g, " ");
  s = s.replace(/,/g, "");
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/^(WORK\s*ORDER|W\.?O\.?|S\.?T\.?)[#.:\s-]*/, "");
    s = s.replace(/^#/, "");
  }
  s = s.replace(/[\s-]+/g, "");
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  return s;
}

/** Corrigo ST# rolls over after 9999 — the same four digits can be two jobs. */
export const WO_WRAP = 9999;

/** Match key: core identity, with leading zeros stripped for pure digits. */
export function woMatchKey(raw: string): string {
  const core = woCore(raw);
  if (!core) return "";
  if (/^\d+$/.test(core)) return core.replace(/^0+/, "") || "0";
  return core;
}

export function woNumeric(raw: string | null | undefined): number | null {
  const key = woMatchKey(raw ?? "");
  if (!/^\d+$/.test(key)) return null;
  const n = Number(key);
  return Number.isFinite(n) ? n : null;
}

export function deskHasWrapped(hits: { wo?: string | null }[]): boolean {
  return hits.some((h) => {
    const n = woNumeric(h.wo);
    return n != null && n >= WO_WRAP;
  });
}

const CLOSED_HIT = new Set([
  "completed",
  "cancelled",
  "canceled",
  "phone resolved",
  "installed",
]);

export function hitClosed(hit: Pick<CorrigoHit, "status" | "done">): boolean {
  if (hit.done) return true;
  return CLOSED_HIT.has(String(hit.status ?? "").trim().toLowerCase());
}

/**
 * After WO-9999 the 4-digit numbers start over. Don't fold a new job onto a
 * closed ticket from the previous cycle when the customer doesn't match.
 */
export function shouldAttachToHit(
  hit: CorrigoHit,
  fileCustomer: string | null | undefined,
  wrapped: boolean,
): boolean {
  if (!wrapped) return true;
  const n = woNumeric(hit.wo);
  if (n == null || n > WO_WRAP) return true;
  if (!hitClosed(hit)) return true;
  if (customersCompatible(hit.customer, fileCustomer)) return true;
  return false;
}

export function wrapRepeatNote(canonicalWo: string): string {
  return `${canonicalWo} used again after 9999`;
}

/** Corrigo form stored on the ticket after a match: WO-#### */
export function woCanonical(raw: string): string {
  const core = woCore(raw);
  if (!core) return "";
  return `WO-${core}`;
}

/** @deprecated use woCanonical */
export function normalizeWo(raw: string): string {
  return woCanonical(raw);
}

export function parseCompletedDate(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const mdY = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (mdY) {
    const month = Number(mdY[1]);
    const day = Number(mdY[2]);
    let year = Number(mdY[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.round(n) * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

export function statusKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function translateStatus(
  raw: string | null,
  completedAt: string | null,
): { status: string | null; unmapped: string | null } {
  const text = (raw ?? "").trim();
  if (!text) {
    return { status: completedAt ? "Completed" : "Open", unmapped: null };
  }
  const mapped = CORRIGO_STATUS[statusKey(text)];
  if (mapped) return { status: mapped, unmapped: null };
  return { status: null, unmapped: text };
}

export function detectBoard(hints: {
  po?: string | null;
  issue?: string | null;
  callType?: string | null;
  existing?: CorrigoBoard | null;
}): CorrigoBoard {
  if (hints.existing) return hints.existing;
  const blob = [hints.po, hints.issue, hints.callType].filter(Boolean).join(" ");
  if (/\b(installs?|installation)\b/i.test(blob)) return "install";
  if (/\b(tlc|factor)\b/i.test(blob)) return "tlc";
  if (/\b(preventative|preventive|\bpm\b)\b/i.test(blob)) return "pm";
  return "service";
}

export function boardLabel(board: CorrigoBoard): string | null {
  if (board === "tlc") return "TLC / Factor";
  if (board === "pm") return "PM";
  if (board === "install") return "Install";
  return null;
}


/** Same account, empty, or Walk-In — safe to fold onto one ticket. */
export function customersCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeCustomerKey(a);
  const nb = normalizeCustomerKey(b);
  if (!na || !nb) return true;
  if (isWalkIn(a) || isWalkIn(b)) return true;
  return na === nb;
}

/** Starting customer on the preview picker. Walk-In stays empty unless the ticket already has a real account. */
export function preferredImportCustomer(
  fileCustomer: string | null | undefined,
  existingCustomer: string | null | undefined,
): string | null {
  const existing = (existingCustomer ?? "").trim() || null;
  const file = (fileCustomer ?? "").trim() || null;
  if (isWalkIn(file)) {
    if (existing && !isWalkIn(existing)) return existing;
    return null;
  }
  return file || existing;
}

export function findHeaderRow(matrix: string[][]): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 5);
  for (let i = 0; i < limit; i++) {
    const cols = mapHeaderRow(matrix[i] ?? []);
    const score = Object.keys(cols).length + (cols.wo != null ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function mapHeaderRow(row: string[]): Partial<Record<CorrigoCol, number>> {
  const cols: Partial<Record<CorrigoCol, number>> = {};
  row.forEach((cell, i) => {
    const key = HEADER_KEYS[normalizeHeader(cell)];
    if (key && cols[key] == null) cols[key] = i;
  });
  return cols;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx == null) return "";
  return String(row[idx] ?? "").trim();
}

export function parseCorrigoMatrix(matrix: string[][]): {
  skipped: number;
  records: CorrigoRecord[];
} {
  if (!matrix.length) return { skipped: 0, records: [] };
  const headerAt = findHeaderRow(matrix);
  const cols = mapHeaderRow(matrix[headerAt] ?? []);
  if (cols.wo == null) {
    throw new Error("Could not find an ST# column. Headers can sit on row 1 or 2.");
  }
  let skipped = 0;
  const byKey = new Map<string, CorrigoRecord>();
  for (let i = headerAt + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (row.every((c) => !String(c ?? "").trim())) continue;
    const rawWo = cell(row, cols.wo);
    const matchKey = woMatchKey(rawWo);
    if (!matchKey) {
      skipped += 1;
      continue;
    }
    byKey.set(matchKey, {
      rawWo,
      matchKey,
      canonicalWo: woCanonical(rawWo),
      technician: cell(row, cols.technician) || null,
      completedAt: parseCompletedDate(cell(row, cols.completedAt)),
      workDone: cell(row, cols.workDone) || null,
      statusRaw: cell(row, cols.status) || null,
      issue: cell(row, cols.issue) || null,
      customer: cell(row, cols.customer) || null,
      po: cell(row, cols.po) || null,
      callType: cell(row, cols.callType) || null,
    });
  }
  return { skipped, records: [...byKey.values()] };
}

export function matchNote(rawWo: string, canonicalWo: string, existingWo?: string | null): string | null {
  const compact = rawWo.trim().replace(/\s+/g, "");
  if (compact && compact.toUpperCase() !== canonicalWo.toUpperCase()) {
    return `matched as ${compact} → ${canonicalWo}`;
  }
  if (existingWo) {
    const existingCompact = existingWo.trim().replace(/\s+/g, "");
    if (existingCompact && existingCompact.toUpperCase() !== canonicalWo.toUpperCase()) {
      return `matched as ${existingWo.trim()} → ${canonicalWo}`;
    }
  }
  return null;
}

export function resolvePreviewRow(
  rec: CorrigoRecord,
  match: { unique: CorrigoHit | null; conflicts: CorrigoHit[] },
  opts: { wrapped?: boolean } = {},
): CorrigoPreviewRow {
  const translated = translateStatus(rec.statusRaw, rec.completedAt);
  const wrapped = !!opts.wrapped;
  const group = [
    ...(match.unique ? [match.unique] : []),
    ...match.conflicts,
  ].filter((h, i, all) => all.findIndex((x) => x.board === h.board && x.id === h.id) === i);
  const hinted = detectBoard({
    po: rec.po,
    issue: rec.issue,
    callType: rec.callType,
  });
  const live = group.filter((h) => !h.duplicateOf);
  const pool = live.length ? live : group;
  const attachable = pool.filter((h) => shouldAttachToHit(h, rec.customer, wrapped));
  const existing = pickKeeper(attachable.length ? attachable : [], hinted);
  const extras = existing
    ? group.filter((h) => h.board !== existing.board || h.id !== existing.id)
    : group;
  const board = detectBoard({
    po: rec.po,
    issue: rec.issue,
    callType: rec.callType,
    existing: existing?.board ?? null,
  });
  const oldStatus = existing?.status ?? null;
  let newStatus: string;
  const statusUnmapped = translated.unmapped;
  if (translated.status) newStatus = translated.status;
  else if (oldStatus) newStatus = oldStatus;
  else newStatus = "Open";
  const siblingIds = extras
    .filter((h) => h.board === "service" || h.board === "tlc" || h.board === existing?.board)
    .filter((h) => h.board === "service" || h.board === "tlc")
    .map((c) => ({ board: c.board, id: c.id }));
  const n = woNumeric(rec.rawWo || rec.canonicalWo);
  const postWrapNumber = n != null && n < 5000;
  const wrapRepeat =
    wrapped && postWrapNumber && (extras.length > 0 || (!existing && group.length > 0));
  const note = existing ? matchNote(rec.rawWo, rec.canonicalWo, existing.wo) : null;

  return {
    wo: rec.canonicalWo,
    rawWo: rec.rawWo,
    matchKey: rec.matchKey,
    canonicalWo: rec.canonicalWo,
    matchNote: wrapRepeat
      ? [note, wrapRepeatNote(rec.canonicalWo)].filter(Boolean).join(" · ")
      : note,
    customer: preferredImportCustomer(rec.customer, existing?.customer),
    fileCustomer: rec.customer,
    existingCustomer: existing?.customer ?? null,
    fileWalkIn: isWalkIn(rec.customer),
    action: existing ? "update" : "create",
    board,
    boardLabel: boardLabel(board),
    jobId: existing?.id ?? null,
    oldStatus,
    newStatus,
    statusUnmapped,
    technician: rec.technician,
    completedAt: rec.completedAt,
    workDone: rec.workDone,
    issue: rec.issue,
    conflictIds: siblingIds.length ? siblingIds : null,
    wrapRepeat,
  };
}

/** Prefer the original ticket on the hinted board. Never skip a match — extras get flagged. */
export function pickKeeper(hits: CorrigoHit[], preferredBoard?: CorrigoBoard | null): CorrigoHit | null {
  if (!hits.length) return null;
  const live = hits.filter((h) => !h.duplicateOf);
  const pool = live.length ? live : hits;
  const byId = (list: CorrigoHit[]) => [...list].sort((a, b) => a.id - b.id)[0] ?? null;
  if (preferredBoard) {
    const preferred = pool.filter((h) => h.board === preferredBoard);
    if (preferred.length) return byId(preferred);
    if (preferredBoard === "service" || preferredBoard === "tlc") {
      const serviceLike = pool.filter((h) => h.board === "service" || h.board === "tlc");
      if (serviceLike.length) return byId(serviceLike);
    }
  }
  const serviceLike = pool.filter((h) => h.board === "service" || h.board === "tlc");
  return byId(serviceLike.length ? serviceLike : pool);
}

export function indexHits(hits: CorrigoHit[]): Map<string, { unique: CorrigoHit | null; conflicts: CorrigoHit[] }> {
  const groups = new Map<string, CorrigoHit[]>();
  for (const hit of hits) {
    const key = woMatchKey(hit.wo ?? "");
    if (!key) continue;
    const list = groups.get(key) ?? [];
    if (!list.some((h) => h.board === hit.board && h.id === hit.id)) list.push(hit);
    groups.set(key, list);
  }
  const out = new Map<string, { unique: CorrigoHit | null; conflicts: CorrigoHit[] }>();
  for (const [key, list] of groups) {
    const keeper = pickKeeper(list);
    if (!keeper) continue;
    const extras = list.filter((h) => h.board !== keeper.board || h.id !== keeper.id);
    out.set(key, { unique: keeper, conflicts: extras });
  }
  return out;
}
