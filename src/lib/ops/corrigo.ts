/** Corrigo report → KatzDesk tickets. Mapping only — no sales fields. */

import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";

export { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";

type BoardStatuses = { service: string; pm: string | null; install: string | null };

/**
 * Corrigo status → the status written on each board (TLC uses the service column).
 * null = keep the ticket's current status; a new ticket gets NEW_TICKET_STATUS.
 * Starred (*) entries are proposed defaults for Chuy to confirm — change them here.
 */
export const CORRIGO_STATUS: Record<string, BoardStatuses> = {
  unassigned: { service: "Open", pm: null, install: null },
  "needs accepting": { service: "Open", pm: null, install: null },
  "waiting for pickup": { service: "Dispatched", pm: "Scheduled", install: null }, // * service, * pm
  "picked up": { service: "Dispatched", pm: "Ready to Dispatch", install: "Ready" }, // * install
  "en route": { service: "Dispatched", pm: "Ready to Dispatch", install: "Ready" }, // * install
  enroute: { service: "Dispatched", pm: "Ready to Dispatch", install: "Ready" }, // * install
  "work started": { service: "In Progress", pm: "In Progress", install: "Ready" }, // * install
  paused: { service: "In Progress", pm: "In Progress", install: "Ready" }, // * install
  "on hold": { service: "Follow-up Needed", pm: null, install: null },
  completed: { service: "Completed", pm: "Completed", install: "Installed" },
  complete: { service: "Completed", pm: "Completed", install: "Installed" },
  cancelled: { service: "Cancelled", pm: "Cancelled", install: null },
  canceled: { service: "Cancelled", pm: "Cancelled", install: null },
};

const NEW_TICKET_STATUS: Record<CorrigoBoard, string> = {
  service: "Open",
  tlc: "Open",
  pm: "Pending Scheduling",
  install: "Not Ready",
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
  "completed date": "completedAt",
  "completion date": "completedAt",
  "completed on": "completedAt",
  "work done": "workDone",
  "operational status": "status",
  status: "status",
  "wo status": "status",
  "work order status": "status",
  "ticket status": "status",
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

/** Corrigo's CSV export names columns TextBox_## (key: normalizeHeader). Empty until Chuy supplies the mapping. */
export const CORRIGO_TEXTBOX_HEADERS: Record<string, CorrigoCol> = {};

export const COL_LABEL: Record<CorrigoCol, string> = {
  wo: "ST#",
  technician: "Primary Service Tech",
  completedAt: "Date/Time Completed",
  workDone: "Work Done",
  status: "Operational Status",
  issue: "Problem Description",
  customer: "Customer Name",
  po: "P.O. #",
  callType: "Call Type",
};

/** Without these every ticket keeps its status / completed date, so the preview warns when one is missing. */
const NEEDED_COLS: CorrigoCol[] = ["status", "completedAt"];

const TEXTBOX = /^text\s*_?box/i;

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
  statusRaw: string | null;
  statusNote: string | null;
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
  // Corrigo numbers are 4 digits; a spreadsheet turns "0855" into 855.
  return `WO-${/^\d{1,3}$/.test(core) ? core.padStart(4, "0") : core}`;
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

/**
 * The status the import writes on this board — the preview and every apply path use it.
 * current = the ticket's status today (null for a new ticket).
 */
export function boardStatus(
  board: CorrigoBoard,
  raw: string | null,
  completedAt: string | null,
  current: string | null,
): { status: string; unmapped: string | null; note: string | null } {
  const text = (raw ?? "").trim();
  if (!text && completedAt) return boardStatus(board, "completed", null, current);
  const fallback = current || NEW_TICKET_STATUS[board];
  const keeps = `${current ? "keeps" : "opens as"} ${fallback}`;
  if (!text) return { status: fallback, unmapped: null, note: `no status in file → ${keeps}` };
  const key = statusKey(text);
  const row = Object.hasOwn(CORRIGO_STATUS, key) ? CORRIGO_STATUS[key] : undefined;
  if (!row) return { status: fallback, unmapped: text, note: `unmapped: ${text} → ${keeps}` };
  if (board === "install" && current === "Installed") return { status: "Installed", unmapped: null, note: null };
  const mapped = board === "pm" ? row.pm : board === "install" ? row.install : row.service;
  if (mapped) return { status: mapped, unmapped: null, note: null };
  return { status: fallback, unmapped: null, note: `${text} has no ${board === "pm" ? "PM" : "install"} status → ${keeps}` };
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


/**
 * Why an imported ticket goes on the For Review list, or null. A ticket the import created is always
 * listed, even closed, so it can be found from there whichever board it went to.
 */
export function corrigoReviewReason(row: {
  created: boolean;
  closed: boolean;
  wrapRepeat: boolean;
}): "open" | "wrap" | "created" | null {
  if (row.wrapRepeat) return "wrap";
  if (!row.closed) return "open";
  if (row.created) return "created";
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

/** Report title / parameter rows can sit above the header (SSRS exports). */
const HEADER_SCAN_ROWS = 15;

export function findHeaderRow(matrix: string[][]): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, HEADER_SCAN_ROWS);
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
    const norm = normalizeHeader(cell);
    const key = HEADER_KEYS[norm] ?? CORRIGO_TEXTBOX_HEADERS[norm];
    if (key && cols[key] == null) cols[key] = i;
  });
  // "Operational Status" wins over a plain "Status" column wherever it sits.
  const op = row.findIndex((c) => normalizeHeader(c) === "operational status");
  if (op >= 0) cols.status = op;
  return cols;
}

function withoutBlanks<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as Partial<T>;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx == null) return "";
  return String(row[idx] ?? "").trim();
}

export type CorrigoParse = {
  skipped: number;
  records: CorrigoRecord[];
  /** Which file header fed each field, e.g. { wo: "TextBox_12" }. */
  columns: Partial<Record<CorrigoCol, string>>;
  /** Status / completed-date columns the file doesn't have. */
  missing: CorrigoCol[];
};

function headerProblem(row: string[]): string {
  const found = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  const list = found.length ? found.slice(0, 40).join(", ") + (found.length > 40 ? ", …" : "") : "(none)";
  const textBox = found.some((h) => TEXTBOX.test(h));
  return (
    `Could not find the ${COL_LABEL.wo} column. Expected headers: ` +
    (Object.keys(COL_LABEL) as CorrigoCol[]).map((c) => COL_LABEL[c]).join(", ") +
    `. Headers found: ${list}.` +
    (textBox
      ? " This is Corrigo's CSV export, which names columns TextBox_##. Export the report to Excel, or send the TextBox list so it can be added."
      : "")
  );
}

export function parseCorrigoMatrix(matrix: string[][]): CorrigoParse {
  if (!matrix.length) return { skipped: 0, records: [], columns: {}, missing: [] };
  const headerAt = findHeaderRow(matrix);
  const header = matrix[headerAt] ?? [];
  const cols = mapHeaderRow(header);
  if (cols.wo == null) {
    // Show the row that looks most like a header: TextBox names, else the first filled row.
    const top = matrix.slice(0, HEADER_SCAN_ROWS);
    const shown =
      top.find((r) => r.some((c) => TEXTBOX.test(String(c ?? "").trim()))) ??
      top.find((r) => r.some((c) => String(c ?? "").trim())) ??
      header;
    throw new Error(headerProblem(shown));
  }
  const columns: Partial<Record<CorrigoCol, string>> = {};
  for (const [k, i] of Object.entries(cols) as [CorrigoCol, number][]) columns[k] = String(header[i] ?? "").trim();
  const missing = NEEDED_COLS.filter((c) => cols[c] == null);
  let skipped = 0;
  const byKey = new Map<string, CorrigoRecord>();
  for (let i = headerAt + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (row.every((c) => !String(c ?? "").trim())) continue;
    const rawWo = cell(row, cols.wo);
    const matchKey = woMatchKey(rawWo);
    // Blank or not a number ("Total", "Subtotal"): not a ticket line.
    if (!/^\d+$/.test(matchKey)) {
      skipped += 1;
      continue;
    }
    const rec: CorrigoRecord = {
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
    };
    const prev = byKey.get(matchKey);
    // Several lines for one ST# (cost lines, subtotals): a later non-blank cell wins; a blank never wipes one.
    byKey.set(matchKey, prev ? { ...prev, ...withoutBlanks(rec) } : rec);
  }
  return { skipped, records: [...byKey.values()], columns, missing };
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
  const resolved = boardStatus(board, rec.statusRaw, rec.completedAt, oldStatus);
  const newStatus = resolved.status;
  const statusUnmapped = resolved.unmapped;
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
    statusRaw: rec.statusRaw,
    statusNote: resolved.note,
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

/** One sheet cell → text. Dates use the cell's own calendar day (not UTC), so a 9 PM finish stays on its day. */
export function stringifyCell(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v)) return String(v);
    const rounded = Math.round(v);
    if (Math.abs(v - rounded) < 1e-6) return String(rounded);
  }
  const s = String(v);
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  return s;
}

/** Vercel refuses a request or response over ~4.5 MB, and server functions add ~26% to the JSON. */
const CORRIGO_CHUNK_BYTES = 1_500_000;
const CORRIGO_CHUNK_ROWS = 300;

export function chunkByBytes<T>(items: T[], maxBytes = CORRIGO_CHUNK_BYTES, maxItems = CORRIGO_CHUNK_ROWS): T[][] {
  const enc = new TextEncoder();
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const item of items) {
    const n = enc.encode(JSON.stringify(item)).length + 1;
    if (cur.length && (size + n > maxBytes || cur.length >= maxItems)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(item);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

export type CorrigoPreviewPart = {
  updateCount: number;
  createCount: number;
  skipped: number;
  conflictCount: number;
  wrapCount: number;
  unmapped: string[];
  rows: CorrigoPreviewRow[];
};

export type CorrigoPreview = CorrigoPreviewPart & Pick<CorrigoParse, "columns" | "missing">;

/** Join the per-chunk previews into one, plus what the browser learned from the header row. */
export function mergeCorrigoPreviews(
  parts: CorrigoPreviewPart[],
  parsed: Pick<CorrigoParse, "skipped" | "columns" | "missing">,
): CorrigoPreview {
  return {
    updateCount: parts.reduce((n, p) => n + p.updateCount, 0),
    createCount: parts.reduce((n, p) => n + p.createCount, 0),
    skipped: parsed.skipped + parts.reduce((n, p) => n + p.skipped, 0),
    conflictCount: parts.reduce((n, p) => n + p.conflictCount, 0),
    wrapCount: parts.reduce((n, p) => n + p.wrapCount, 0),
    unmapped: [...new Set(parts.flatMap((p) => p.unmapped))],
    rows: parts.flatMap((p) => p.rows),
    columns: parsed.columns,
    missing: parsed.missing,
  };
}
