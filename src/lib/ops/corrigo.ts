/** Corrigo report → KatzDesk tickets. Mapping only — no sales fields. */

import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";
import { CLOSED_CALL, CLOSED_PM } from "./ticket-status.ts";

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
  equipment: "equipment",
  asset: "equipment",
  "asset name": "equipment",
  "equipment description": "equipment",
  "equipment package": "equipment",
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
  equipment: "Equipment",
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
  | "callType"
  | "equipment";

export type CorrigoBoard = "service" | "tlc" | "pm" | "install";

export type CorrigoRecord = {
  rawWo: string;
  matchKey: string;
  canonicalWo: string;
  technician: string | null;
  completedAt: string | null;
  /** The completed cell as written, so the preview can show a date it couldn't read. */
  completedRaw: string | null;
  workDone: string | null;
  statusRaw: string | null;
  issue: string | null;
  customer: string | null;
  po: string | null;
  callType: string | null;
  /** The machines on the row, from an Equipment / Asset column. */
  equipment?: string | null;
};

export type CorrigoHit = {
  board: CorrigoBoard;
  id: number;
  status: string;
  customer: string | null;
  wo: string | null;
  duplicateOf?: number | null;
  done?: boolean;
  /** YYYY-MM-DD on the ticket now. */
  completedAt?: string | null;
  /** YYYY-MM-DD the ticket came in, or its first activity entry when it has no received date. */
  received?: string | null;
  /** NetSuite Sales Order (service tickets only). */
  billedSo?: string | null;
  hasCharges?: boolean;
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
  /** The completed cell as written (apply needs it: a date it couldn't read never reopens a ticket). */
  completedRaw: string | null;
  /** The ticket's completed date before this import. */
  oldCompletedAt: string | null;
  /** Billed on a Sales Order: the import keeps oldCompletedAt whatever Corrigo says. */
  completedKept: boolean;
  /** Corrigo reopened the ticket: the import clears oldCompletedAt. */
  completedCleared: boolean;
  completedNote: string | null;
  workDone: string | null;
  issue: string | null;
  conflictIds: { board: CorrigoBoard; id: number }[] | null;
  wrapRepeat: boolean;
  /** Other tickets from this cycle with the number that the row was kept off ("WO-0368 is also on service #528 (…)"). */
  shared?: string | null;
  /** No install had this WO: jobId is the account's open install whose equipment matches. */
  byEquipment: boolean;
};

/** An install with no WO yet that isn't archived or complete, with its machine models. */
/** machines: read by exactMachines, empty when they aren't exactly catalog names. */
export type OpenInstall = CorrigoHit & { machines: string[] };

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

/** Came in within 365 days of the import (today), so it is from the current run of ST# numbers. */
function recentTicket(hit: CorrigoHit, today: string | null | undefined): boolean {
  if (!today || !hit.received) return false;
  return hit.received >= new Date(Date.parse(today) - 365 * 86_400_000).toISOString().slice(0, 10);
}

/** After the wrap, a ticket from this cycle wins over an old-cycle copy of the same number. */
export function thisCycleFirst(hits: CorrigoHit[], wrapped: boolean, today: string | null | undefined): CorrigoHit[] {
  const recent = wrapped ? hits.filter((h) => recentTicket(h, today)) : [];
  return recent.length ? recent : hits;
}

/**
 * The tickets with a row's number it may go on, this cycle's first. After the wrap a closed ticket ≤9999 needs the
 * file's customer (shouldAttachToHit), except that this cycle's copies (received in the last 365 days) are the same
 * job however Corrigo spells the customer — as long as they all belong to one customer. When they don't, only a
 * ticket with the file's customer counts.
 */
export function attachableHits(
  hits: CorrigoHit[],
  fileCustomer: string | null | undefined,
  wrapped: boolean,
  today: string | null | undefined,
): CorrigoHit[] {
  const recent = wrapped ? hits.filter((h) => recentTicket(h, today)) : [];
  const named = recent.filter((h) => !isWalkIn(h.customer)).map((h) => normalizeCustomerKey(h.customer));
  const oneCustomer = new Set(named.filter(Boolean)).size <= 1;
  const ok = hits.filter((h) => shouldAttachToHit(h, fileCustomer, wrapped) || (oneCustomer && recent.includes(h)));
  // Two customers' tickets carry the number this cycle: only the file customer's own copies count, open ones too.
  return thisCycleFirst(oneCustomer ? ok : ok.filter((h) => customersCompatible(h.customer, fileCustomer)), wrapped, today);
}

/**
 * After the wrap, same-number service tickets from different cycles (one received in the last 365 days, one not)
 * are different jobs: pairs the duplicate merge must leave alone.
 */
export function crossCyclePairs(hits: CorrigoHit[], today: string): { keeperId: number; extraId: number }[] {
  const groups = new Map<string, CorrigoHit[]>();
  for (const h of hits) {
    const key = woMatchKey(h.wo ?? "");
    if (!key || h.duplicateOf || (h.board !== "service" && h.board !== "tlc")) continue;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  const out: { keeperId: number; extraId: number }[] = [];
  for (const list of groups.values()) {
    for (const a of list) {
      for (const b of list) {
        if (a.id < b.id && recentTicket(a, today) !== recentTicket(b, today)) out.push({ keeperId: a.id, extraId: b.id });
      }
    }
  }
  return out;
}

/**
 * After WO-9999 the 4-digit numbers start over. Don't fold a new job onto a closed ticket when the customer doesn't
 * match (attachableHits lets this cycle's copies through).
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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseCompletedDate(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    // CSV text the spreadsheet library leaves alone: "Mon 10/19/2026", "Oct 19, 2026 3:45 PM".
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "")
    .replace(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i, (all, mon: string, d: string, y: string) => {
      const m = MONTHS.indexOf(mon.toLowerCase()) + 1;
      return m ? `${m}/${d}/${y}` : all;
    });
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

/**
 * Corrigo put a service ticket, TLC or PM back to an open status (one the file's status maps to, not a kept one)
 * with no completed date: the import clears its completed date. Installs never move back.
 */
export function corrigoReopens(
  board: CorrigoBoard,
  raw: string | null,
  completedAt: string | null,
  current: string | null,
  /** The completed cell as written: a date the import couldn't read still means Corrigo has one. */
  completedRaw?: string | null,
): boolean {
  if (completedAt || completedRaw?.trim() || board === "install") return false;
  const next = boardStatus(board, raw, null, current);
  return !next.note && !(board === "pm" ? CLOSED_PM : CLOSED_CALL).has(next.status);
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
      completedRaw: cell(row, cols.completedAt) || null,
      workDone: cell(row, cols.workDone) || null,
      statusRaw: cell(row, cols.status) || null,
      issue: cell(row, cols.issue) || null,
      customer: cell(row, cols.customer) || null,
      po: cell(row, cols.po) || null,
      callType: cell(row, cols.callType) || null,
      equipment: cell(row, cols.equipment) || null,
    };
    const prev = byKey.get(matchKey);
    // Several lines for one ST# (cost lines, subtotals): a later non-blank cell wins; a blank never wipes one.
    byKey.set(matchKey, prev ? { ...prev, ...withoutBlanks(rec) } : rec);
  }
  return { skipped, records: [...byKey.values()], columns, missing };
}

/**
 * The completed date an import writes on an existing ticket. Corrigo's date wins, and a reopened ticket
 * (corrigoReopens) loses its date, except on a ticket billed on a Sales Order: its date picked the billing week
 * and NetSuite already has it. A billed ticket with no date keeps none, as the update's SQL does.
 */
export function completedOnUpdate(
  fileDate: string | null | undefined,
  deskDate: string | null | undefined,
  billedSo: string | null | undefined,
  reopened = false,
): { value: string | null; change: "set" | "moved" | "billed" | "cleared" | null } {
  const desk = deskDate || null;
  const file = fileDate || null;
  if (!file && reopened && desk) {
    return String(billedSo ?? "").trim() ? { value: desk, change: "billed" } : { value: null, change: "cleared" };
  }
  if (!file || file === desk) return { value: desk, change: null };
  if (String(billedSo ?? "").trim()) return { value: desk, change: "billed" };
  return { value: file, change: desk ? "moved" : "set" };
}

function completedNote(
  rec: CorrigoRecord,
  existing: CorrigoHit | null,
  next: ReturnType<typeof completedOnUpdate> | null,
): string | null {
  if (!rec.completedAt && rec.completedRaw) return `couldn't read the date "${rec.completedRaw}"`;
  if (!existing || !next) return null;
  if (next.change === "billed") return `billed on ${String(existing.billedSo).trim()} — keeps ${existing.completedAt || "no date"}`;
  // Billing exports pick tickets by completed date, and nothing records which exports went out.
  if (next.change === "moved" && existing.hasCharges) return "has charges, not billed yet — check it wasn't in an earlier export";
  return null;
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

const VOLTS = /\b\d{3}\s*v(?:olts?)?\b/gi;
/** A serial on its own line ("SN: 4471", "S/N 4471", "Serial # 4471"), or one ending a machine's line. */
const SERIAL = String.raw`(?:s\/?n|serial(?:\s*(?:#|no\.?|number))?)`;
// Spaced or after ":"/"#" it is any token with a digit, but not a count ("x2", "2 units"); run together, only digits.
const SERIAL_NUMBER = String.raw`${SERIAL}(?:(?:\s*[:#]\s*|\s+)(?!(?:x\d+|\d+x|\d+-?units?)$)[a-z0-9-]*\d[a-z0-9-]*|\d[\d-]*)$`;
const SERIAL_LINE = new RegExp(`^${SERIAL_NUMBER}`, "i");
const SERIAL_TAIL = new RegExp(String.raw`\s+${SERIAL_NUMBER}`, "i");

/** Words a problem description may put before or after its machine's name ("Install new …", "… set up"). */
const FILLER = new Set([
  "install", "installs", "installed", "installation", "new", "of", "the", "a", "an", "for", "at", "to", "please", "set",
  "setup", "up", "deliver", "delivery",
]);

/** Lowercase, apostrophes and voltage dropped ("C’2s 120V" → "c2s"), one space between words, no closing period. */
const plain = (text: string) =>
  text.toLowerCase().replace(VOLTS, " ").replace(/['’‘`´]/g, "").replace(/×/g, "x").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").trim();

/** The words without filler at either end, joined. */
function unfilled(words: string[]): string {
  const out = words.filter(Boolean);
  while (out.length && FILLER.has(out[0]!)) out.shift();
  while (out.length && FILLER.has(out.at(-1)!)) out.pop();
  return out.join(" ");
}

/**
 * A catalog name as a text may write it: in full or before " - ", with or without its brand. Without the brand it
 * must keep two words or a digit ("tb3", "linea mini"), so a bare "grinder" is never one.
 */
function spellingsOf(name: string): string[] {
  return [name, name.split(" - ")[0]!].flatMap((n) => {
    const words = plain(n).split(" ");
    const bare = unfilled(words.slice(["la", "de"].includes(words[0]!) ? 2 : 1));
    return [unfilled(words), bare.includes(" ") || /\d/.test(bare) ? bare : ""];
  }).filter(Boolean);
}

/** The one catalog model a text is exactly a spelling of, when no other model shares that spelling or starts with it. */
function modelSpelled(said: string, catalog: string[]): string | null {
  const owners = said ? catalog.filter((n) => spellingsOf(n).includes(said)) : [];
  if (new Set(owners.map(plain)).size !== 1) return null;
  const model = owners[0]!;
  const longer = (o: string) => o.length > said.length && o.startsWith(said) && /[^a-z0-9]/.test(o[said.length]!);
  return catalog.some((n) => plain(n) !== plain(model) && spellingsOf(n).some(longer)) ? null : model;
}

/** "Install 2 x new Cameo c'2s" → two of that model: filler at the ends and an optional leading "N x" (N 1-9) aside. */
function spelledMachines(text: string, catalog: string[]): string[] | null {
  const [, qty = "1", rest = ""] = /^(?:([1-9]) ?x )?(.*)$/.exec(unfilled(plain(text).split(" ")))!;
  const model = modelSpelled(unfilled(rest.split(" ")), catalog);
  return model ? Array<string>(Number(qty)).fill(model) : null;
}

/**
 * Machines read exactly, one entry per unit: each line (or ; or , between machines) is exactly one catalog spelling
 * with its voltage aside. A serial may end a machine's line, or follow the line's last machine on its own line, at
 * most one per unit. null when anything else is there, so a guessed model or count never matches.
 */
export function exactMachines(pieces: string[], catalog: string[]): string[] | null {
  const out: string[] = [];
  let serialsLeft = 0;
  for (const piece of pieces.flatMap((p) => p.split(/\r?\n|;/))) {
    const line = piece.trim();
    if (!line) continue;
    if (SERIAL_LINE.test(line)) {
      if (serialsLeft-- <= 0) return null;
      continue;
    }
    const read = (texts: string[]) => {
      const each = texts.map((t) => spelledMachines(t.replace(SERIAL_TAIL, "").trim(), catalog));
      if (!each.every(Boolean)) return null;
      // Serial lines that follow belong to the line's last machine.
      const last = texts.length - 1;
      return { units: each.flat() as string[], left: each[last]!.length - (SERIAL_TAIL.test(texts[last]!) ? 1 : 0) };
    };
    // Some catalog names have a comma ('Bunn ITCB-DV, 29" w/Flip Tray'); otherwise a comma is between machines.
    const got = read([line]) ?? (line.includes(",") ? read(line.split(",")) : null);
    if (!got) return null;
    serialsLeft = got.left;
    out.push(...got.units);
  }
  return out.length ? out : null;
}

/**
 * Whether a problem description names an install's machines (read by exactMachines): the same one model, the same
 * number of units ("Install new Cameo c'2s", "2 x Bunn TB3"). Anything else — another word, a second machine,
 * punctuation between names, part of a name — doesn't.
 */
export function descriptionNames(text: string, machines: string[], catalog: string[]): boolean {
  const named = spelledMachines(text, catalog);
  return !!named && named.length === machines.length && named.every((m, i) => m === machines[i]);
}

/**
 * An install row whose WO no install has goes on the account's open install only when there is exactly one and
 * the row names the same machines as its equipment package. note says what happened either way.
 */
function installByEquipment(
  rec: CorrigoRecord,
  installs: OpenInstall[],
  catalog: string[],
  taken: Set<number>,
): { install: OpenInstall | null; note: string } | null {
  const key = isWalkIn(rec.customer) ? "" : normalizeCustomerKey(rec.customer);
  const mine = key ? installs.filter((i) => normalizeCustomerKey(i.customer) === key) : [];
  if (!mine.length) return null;
  const free = mine.filter((i) => !taken.has(i.id));
  if (!free.length) return { install: null, note: `install #${mine[0].id} already matched by an earlier row` };
  const only = free[0]!;
  const several = { install: null, note: `${free.length === 2 ? "two" : free.length} installs could match` };
  const unread = { install: null, note: `install #${only.id}'s equipment isn't written as catalog names` };
  if (!rec.equipment?.trim()) {
    // With no Equipment column, only a problem description that is exactly the install's machine name counts.
    if (free.length > 1) return several;
    if (!only.machines.length) return unread;
    if (!descriptionNames(rec.issue ?? "", only.machines, catalog)) {
      return { install: null, note: `the problem description doesn't name install #${only.id}'s equipment` };
    }
  } else {
    // The Equipment column is read as exactly as the install: the same models, the same number of each.
    const named = exactMachines([rec.equipment], catalog);
    if (!named) return { install: null, note: "the Equipment column isn't written as catalog names" };
    if (free.length > 1) return several;
    if (!only.machines.length) return unread;
    if ([...named].sort().join("\n") !== [...only.machines].sort().join("\n")) {
      return { install: null, note: `equipment differs from install #${only.id}` };
    }
  }
  return { install: only, note: `install #${only.id} matched by account and equipment` };
}

export function resolvePreviewRow(
  rec: CorrigoRecord,
  match: { unique: CorrigoHit | null; conflicts: CorrigoHit[] },
  opts: {
    wrapped?: boolean;
    today?: string;
    /** Open installs with no WO, and the equipment catalog, for an install row no WO matches. */
    installs?: OpenInstall[];
    catalog?: string[];
    /** Installs an earlier row of this import already attached to. */
    taken?: Set<number>;
  } = {},
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
  const woHit = pickKeeper(attachableHits(pool, rec.customer, wrapped, opts.today), hinted);
  const equip =
    !woHit && hinted === "install"
      ? installByEquipment(rec, opts.installs ?? [], opts.catalog ?? [], opts.taken ?? new Set())
      : null;
  const existing = woHit ?? equip?.install ?? null;
  // After the wrap, a copy from the other cycle than the chosen ticket, or another customer's, is a different job.
  const others = existing ? group.filter((h) => h.board !== existing.board || h.id !== existing.id) : group;
  const otherJob = (h: CorrigoHit) =>
    !!existing &&
    wrapped &&
    (recentTicket(h, opts.today) !== recentTicket(existing, opts.today) || !customersCompatible(h.customer, existing.customer));
  const extras = others.filter((h) => !otherJob(h));
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
  const date = existing
    ? completedOnUpdate(
        rec.completedAt,
        existing.completedAt,
        existing.billedSo,
        corrigoReopens(board, rec.statusRaw, rec.completedAt, oldStatus, rec.completedRaw),
      )
    : null;
  const siblingIds = extras
    .filter((h) => h.board === "service" || h.board === "tlc" || h.board === existing?.board)
    .filter((h) => h.board === "service" || h.board === "tlc")
    .map((c) => ({ board: c.board, id: c.id }));
  const n = woNumeric(rec.rawWo || rec.canonicalWo);
  const postWrapNumber = n != null && n < 5000;
  // This cycle's tickets with the number that the row doesn't go on and won't merge: named, and sent to For Review.
  const strangers = wrapped ? others.filter((h) => recentTicket(h, opts.today) && (!existing || otherJob(h))) : [];
  const shared = strangers.length
    ? `${rec.canonicalWo} is also on ${strangers.map((h) => `${h.board} #${h.id} (${h.customer || "no customer"})`).join(", ")}`
    : null;
  // Otherwise a row on this cycle's ticket is never a repeat; on an old-cycle ticket it is when other copies exist.
  const wrapRepeat =
    wrapped &&
    (strangers.length > 0 ||
      (postWrapNumber && (existing ? !recentTicket(existing, opts.today) && others.length > 0 : group.length > 0)));
  const note = woHit ? matchNote(rec.rawWo, rec.canonicalWo, woHit.wo) : null;

  return {
    wo: rec.canonicalWo,
    rawWo: rec.rawWo,
    matchKey: rec.matchKey,
    canonicalWo: rec.canonicalWo,
    matchNote:
      [
        note,
        equip?.note,
        shared ?? (wrapRepeat ? wrapRepeatNote(rec.canonicalWo) : null),
      ]
        .filter(Boolean)
        .join(" · ") || null,
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
    completedRaw: rec.completedRaw ?? null,
    oldCompletedAt: existing?.completedAt ?? null,
    completedKept: date?.change === "billed",
    completedCleared: date?.change === "cleared",
    completedNote: completedNote(rec, existing, date),
    workDone: rec.workDone,
    issue: rec.issue,
    conflictIds: siblingIds.length ? siblingIds : null,
    wrapRepeat,
    shared,
    byEquipment: !!equip?.install,
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
