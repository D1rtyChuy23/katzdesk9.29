/** Corrigo report → KatzDesk tickets. Mapping only — no sales fields. */

import { customersLooselyMatch, customersStrictlyMatch } from "./clean-names.ts";
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
  /** Installs only: every work order the install carries (the primary included), with Corrigo's status for each. */
  wos?: InstallWo[];
};

/** One work order on an install project, with the status Corrigo last gave it. */
export type InstallWo = { wo: string; status: string | null; completedAt: string | null };

/** An install as an import row finds it: its status, completed date and work orders. */
export type InstallState = { status: string; completedAt: string | null; wos: InstallWo[] };

/** One choice on an install row's picker: an open install of the account, or (id null) a new install. */
export type InstallOption = {
  id: number | null;
  label: string;
  /** The install's customer; for a new install, the file's. */
  customer: string | null;
  /** Machine names for the label ("Eversys e'4m, Mahlkonig E65S"). */
  summary: string;
  /** The install's customer when it isn't the file's account (a name that only starts the same): listed, never picked. */
  otherName?: string | null;
  /** A new install an earlier row of this file opens (that row's WO match key); id is newInstallChoice(key). */
  newFrom?: string | null;
  /** The install before this import (null for a new one). */
  state: InstallState | null;
  /** The row names exactly this install's machines. */
  byEquipment: boolean;
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
  /** No install had this WO: jobId is the open install picked for the account (byEquipment or not). */
  byAccount: boolean;
  /**
   * An install row no install's WO matches, for an account with open installs: attach to one of them, or open a new
   * install (id null, always last). installChoice is the one chosen; the preview preselects it.
   */
  installOptions: InstallOption[] | null;
  installChoice: number | null;
  /** The install the row's WO is already on, before this import: its other work orders decide its status. */
  installState: InstallState | null;
  /** WOs the file's later rows put on the same install (settleInstallRows); the import counts them as the preview did. */
  installSiblings?: InstallWo[] | null;
  /** The preview's own preselection (installChoice is what the walk settled on). */
  installPreselect?: number | null;
  /** The row goes on the new install an earlier row of this file opens: that row's WO match key. */
  installNewFrom?: string | null;
  /** The machines the row names exactly (Equipment column, else the problem description), or null. */
  namedMachines?: string[] | null;
};

/**
 * An open install (not archived, not complete) the account's install rows may attach to. machines: read by
 * exactMachines, empty when they aren't exactly catalog names. summary: the machine names as listed.
 */
export type OpenInstall = CorrigoHit & { machines: string[]; summary: string; wos: InstallWo[] };

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
  all: CorrigoHit[],
  fileCustomer: string | null | undefined,
  wrapped: boolean,
  today: string | null | undefined,
  /** The file's row: its status and completed date say whether it is that old project's WO or a new job. */
  row?: { statusRaw: string | null; completedAt: string | null } | null,
): CorrigoHit[] {
  // After the wrap, a closed install whose WO came in over a year ago is another job when the row is open, or was
  // completed after the project was. Completed on or before the project's date, it is the same (a long project).
  // Kept only when both completed dates are known and the row's is not later.
  const reused = (h: CorrigoHit) =>
    !row ||
    !installWoDone({ status: row.statusRaw, completedAt: row.completedAt }) ||
    !row.completedAt ||
    !h.completedAt ||
    row.completedAt > h.completedAt;
  const hits = wrapped
    ? all.filter(
        (h) => !(h.board === "install" && hitClosed(h) && !recentTicket(h, today) && (woNumeric(h.wo) ?? Infinity) <= WO_WRAP && reused(h)),
      )
    : all;
  const recent = wrapped ? hits.filter((h) => recentTicket(h, today)) : [];
  const named = recent.filter((h) => !isWalkIn(h.customer)).map((h) => normalizeCustomerKey(h.customer));
  const oneCustomer = new Set(named.filter(Boolean)).size <= 1;
  const ok = hits.filter((h) => shouldAttachToHit(h, fileCustomer, wrapped) || (oneCustomer && recent.includes(h)));
  // Two customers' tickets carry the number this cycle: only the file customer's own copies count, open ones too.
  return thisCycleFirst(oneCustomer ? ok : ok.filter((h) => customersCompatible(h.customer, fileCustomer)), wrapped, today);
}

/** Two installs carrying one WO: the one with the file's customer (strict match) is the WO's, when there is one. */
export function preferFileCustomerInstalls(hits: CorrigoHit[], fileCustomer: string | null | undefined): CorrigoHit[] {
  const installs = hits.filter((h) => h.board === "install");
  if (installs.length < 2) return hits;
  const named = installs.filter((h) => customersStrictlyMatch(h.customer, fileCustomer));
  return named.length ? hits.filter((h) => h.board !== "install" || named.includes(h)) : hits;
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
// The serial is one token with at least three digits ("ITCB064919", "X482"), so a count ("2pcs", "1of2") never is.
const SERIAL_NUMBER = String.raw`${SERIAL}(?:\s*[:#]\s*|\s+|(?=\d))(?=(?:[a-z-]*\d){3})([a-z0-9-]+)$`;
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

/** The serial a line ends with or is, unless that "serial" is a catalog model ("SN CBS-1231" may be a Fetco brewer). */
function serialOf(re: RegExp, text: string, catalog: string[]): string | null {
  const token = re.exec(text)?.[1];
  return token && !spelledMachines(token, catalog) ? token : null;
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
    if (serialOf(SERIAL_LINE, line, catalog)) {
      if (serialsLeft-- <= 0) return null;
      continue;
    }
    const read = (texts: string[]) => {
      const tails = texts.map((t) => !!serialOf(SERIAL_TAIL, t, catalog));
      const each = texts.map((t, i) => spelledMachines(tails[i] ? t.replace(SERIAL_TAIL, "") : t, catalog));
      if (!each.every(Boolean)) return null;
      // Serial lines that follow belong to the line's last machine.
      const last = texts.length - 1;
      return { units: each.flat() as string[], left: each[last]!.length - (tails[last] ? 1 : 0) };
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

/** Whether Corrigo's status for one of an install's work orders closes it (Completed, or a completed date alone). */
export function installWoDone(w: Pick<InstallWo, "status" | "completedAt">): boolean {
  return boardStatus("install", w.status, w.completedAt, null).status === "Installed";
}

/** The install's work orders once this row's WO is on it: a WO it already has takes the row's status. */
export function withInstallWo(
  wos: InstallWo[],
  row: { canonicalWo?: string; wo?: string; matchKey: string; statusRaw: string | null; completedAt: string | null },
): InstallWo[] {
  const at = wos.findIndex((w) => woMatchKey(w.wo) === row.matchKey);
  const prev = at >= 0 ? wos[at]! : null;
  const next: InstallWo = {
    wo: prev?.wo || row.canonicalWo || row.wo || row.matchKey,
    // A blank cell never wipes what Corrigo said before.
    status: row.statusRaw?.trim() || prev?.status || null,
    completedAt: row.completedAt || prev?.completedAt || null,
  };
  return at >= 0 ? wos.map((w, i) => (i === at ? next : w)) : [...wos, next];
}

/**
 * What one Corrigo row does to an install (the preview and the import both use it). With one work order it is today's
 * rule. With two or more, a Completed WO marks the install Installed only when every one of its WOs is completed;
 * until then the install keeps its status and completed date. An Installed install never moves back.
 */
export function installStatusFromCorrigo(
  state: InstallState,
  row: { canonicalWo?: string; wo?: string; matchKey: string; statusRaw: string | null; completedAt: string | null },
): {
  status: string;
  unmapped: string | null;
  note: string | null;
  completedAt: string | null;
  date: ReturnType<typeof completedOnUpdate>;
  wos: InstallWo[];
  done: number;
} {
  const resolved = boardStatus("install", row.statusRaw, row.completedAt, state.status);
  const wos = withInstallWo(state.wos, row);
  const done = wos.filter(installWoDone).length;
  const date = completedOnUpdate(row.completedAt, state.completedAt, null);
  if (wos.length < 2 || resolved.status !== "Installed") return { ...resolved, completedAt: date.value, date, wos, done };
  if (state.status === "Installed" || done === wos.length) {
    // The project's completed date is its last work order's: an earlier WO's date never moves it back.
    const last = wos.map((w) => w.completedAt).filter((d): d is string => !!d).sort().at(-1) ?? null;
    const target = last && state.completedAt && last < state.completedAt ? state.completedAt : (last ?? row.completedAt);
    const all = completedOnUpdate(target, state.completedAt, null);
    return { ...resolved, completedAt: all.value, date: all, wos, done };
  }
  const keep = state.status || NEW_TICKET_STATUS.install;
  return {
    status: keep,
    unmapped: null,
    note: `${done} of ${wos.length} work orders completed → keeps ${keep}`,
    completedAt: state.completedAt,
    date: { value: state.completedAt, change: null },
    wos,
    done,
  };
}

const sameMachines = (a: string[], b: string[]) => [...a].sort().join("\n") === [...b].sort().join("\n");

/**
 * The open installs an install row whose WO no install has may attach to, WOs or not. The account's installs match
 * strictly ("Baldi Management" is "Baldi Management Group Inc."); an install whose name only starts the same
 * ("Federal Grill" for "Federal Grill - Katy") is listed too, under its own name, but never preselected. The
 * account's one open install is preselected unless the row names other equipment — the Equipment column, else the
 * problem description, read exactly as catalog machines and different from that install's exact machines. Two or
 * more: a new install is preselected; any can still be chosen.
 */
function installCandidates(
  rec: CorrigoRecord,
  installs: OpenInstall[],
  catalog: string[],
): { candidates: OpenInstall[]; choice: OpenInstall | null; note: string; byEquipment: boolean; strict: Set<number> } | null {
  if (isWalkIn(rec.customer)) return null;
  const listed = installs.filter((i) => customersLooselyMatch(i.customer, rec.customer));
  if (!listed.length) return null;
  const mine = listed.filter((i) => customersStrictlyMatch(i.customer, rec.customer));
  const strict = new Set(mine.map((i) => i.id));
  // The account's installs first, then the similar names.
  const candidates = [...mine, ...listed.filter((i) => !strict.has(i.id))];
  const none = (note: string) => ({ candidates, choice: null, note, byEquipment: false, strict });
  if (!mine.length) {
    const others = listed.map((i) => `#${i.id}`).join(", ");
    return none(
      listed.length === 1
        ? `install #${listed[0]!.id} is on another name (${listed[0]!.customer}) — not picked`
        : `installs ${others} are on other names — not picked`,
    );
  }
  if (mine.length > 1) return none(`${mine.length === 2 ? "two" : mine.length} installs could match`);
  const only = mine[0]!;
  const column = !!rec.equipment?.trim();
  const named = column ? exactMachines([rec.equipment!], catalog) : spelledMachines(rec.issue ?? "", catalog);
  if (named && only.machines.length) {
    if (!sameMachines(named, only.machines)) {
      return none(column ? `equipment differs from install #${only.id}` : `the problem description doesn't name install #${only.id}'s equipment`);
    }
    return { candidates, choice: only, note: `install #${only.id} matched by account and equipment`, byEquipment: true, strict };
  }
  return { candidates, choice: only, note: `install #${only.id} is the account's only open install`, byEquipment: false, strict };
}

/** "Attach to install #12 · Eversys e'4m · Ready · WO-0831, WO-0855"; another name shows after the number. */
export function installOptionLabel(id: number, summary: string, state: InstallState, otherName?: string | null): string {
  const wos = state.wos.map((w) => w.wo).join(", ");
  return `Attach to install #${id}${otherName ? ` (${otherName})` : ""} · ${summary || "no equipment listed"} · ${state.status} · ${wos || "no WO yet"}`;
}

export const NEW_INSTALL_LABEL = "Create new install";

/** An install row's only completed-date note: a date Corrigo wrote that couldn't be read. */
const unreadable = (row: Pick<CorrigoPreviewRow, "completedAt" | "completedRaw">) =>
  !row.completedAt && row.completedRaw ? `couldn't read the date "${row.completedRaw}"` : null;

/** The work orders the import's later rows put on an install, for a row's status: the install's own WOs win. */
export function withSiblingWos(wos: InstallWo[], siblings: InstallWo[] | null | undefined, matchKey: string): InstallWo[] {
  const have = new Set([...wos.map((w) => woMatchKey(w.wo)), matchKey]);
  return [...wos, ...(siblings ?? []).filter((w) => !have.has(woMatchKey(w.wo)))];
}

/** The picker's choice for "the new install from WO-0901": a number no install id can be. */
export function newInstallChoice(matchKey: string): number {
  return -(Number(matchKey) + 1);
}

export const newInstallLabel = (wo: string) => `Attach to the new install from ${wo}`;

type NewInstall = { id: number; key: string; wo: string; account: string; customer: string | null; machines: string[] | null };

/**
 * Walk the rows in order with each install row's choice (the preview's preselection, or what the person picked), so
 * a second row for one install sees the first row's WO on it — the order the import writes them. A row's status
 * also counts the WOs the file's later rows put on that install (installSiblings, which the import reads too), so
 * WO-0831 Completed with WO-0855 still open in the same file doesn't install the project.
 *
 * Several rows for one account (strict match, not Walk-In) whose WOs are on no ticket and that has no open install:
 * the first opens the install and each later one goes on it as another WO ("Attach to the new install from WO-0901",
 * preselected; Create new install can still be chosen). A row that names other equipment exactly than that row
 * preselects its own new install. Choosing something else on the first row hands the role to the next.
 *
 * `choiceOf` gives a row's chosen install (undefined: the preselection; a "new install" choice whose row handed the
 * role on counts as undefined too); `included` leaves unchecked rows out; `customerOf` is the customer the person set
 * on a row, which names the new install a first row opens (its followers keep that name).
 */
export function settleInstallRows<T extends CorrigoPreviewRow>(
  rows: T[],
  choiceOf: (row: T) => number | null | undefined = () => undefined,
  included: (row: T) => boolean = () => true,
  customerOf: (row: T) => string | null | undefined = () => undefined,
): T[] {
  const sim = new Map<number, InstallState>();
  const stateOf = (id: number, base: InstallState | null) => sim.get(id) ?? base;
  // The options the preview found (an earlier walk's "new install" choices are rebuilt each time).
  const ownOptions = (row: T) => row.installOptions?.filter((o) => !o.newFrom) ?? null;
  // No WO matched and the account has no open install of its own (a similar name may be listed): rows that combine.
  const combinable = (row: T) =>
    row.action !== "skip" &&
    row.board === "install" &&
    !row.installState &&
    !!row.fileCustomer?.trim() &&
    !isWalkIn(row.fileCustomer) &&
    (ownOptions(row) ?? []).every((o) => o.id == null || !!o.otherName);
  const isInstallRow = (row: T) =>
    row.action !== "skip" && row.board === "install" && (!!row.installOptions || !!row.installState || combinable(row));
  const made: NewInstall[] = [];
  const optionsOf: (InstallOption[] | null)[] = [];
  const opener: (NewInstall | null)[] = [];
  // First pass, in file order: each row's install, and the new installs rows open.
  const targets = rows.map((row, i): number | null => {
    optionsOf[i] = null;
    opener[i] = null;
    if (!isInstallRow(row)) return null;
    const own = ownOptions(row);
    if (!own && row.installState) return row.action === "update" ? row.jobId : null;
    const mine = combinable(row) ? made.filter((m) => customersStrictlyMatch(m.account, row.fileCustomer)) : [];
    const fresh = mine.map(
      (m): InstallOption => ({ id: m.id, label: newInstallLabel(m.wo), customer: m.customer, summary: "", state: null, byEquipment: false, newFrom: m.key }),
    );
    const create: InstallOption = own?.find((o) => o.id == null) ?? {
      id: null,
      label: NEW_INSTALL_LABEL,
      customer: preferredImportCustomer(row.fileCustomer, null),
      summary: "",
      state: null,
      byEquipment: false,
    };
    const options = own || fresh.length ? [...(own ?? []).filter((o) => o.id != null), ...fresh, create] : null;
    optionsOf[i] = options;
    const explicit = choiceOf(row);
    const valid = explicit !== undefined && (explicit === null || !!options?.some((o) => o.id === explicit));
    // "The new install from WO-0901" after WO-0901 handed the role on: the row follows whoever has it now.
    const stale = explicit != null && explicit < 0 && !valid;
    let choice: number | null;
    if (valid) choice = explicit!;
    else if (explicit !== undefined && !stale) choice = null;
    else {
      const differs = (m: NewInstall) => !!m.machines && !!row.namedMachines && !sameMachines(m.machines, row.namedMachines);
      const fit = mine.find((m) => !differs(m));
      const pre = row.installPreselect !== undefined ? row.installPreselect : row.installChoice;
      choice = fit ? fit.id : options?.some((o) => o.id === pre) ? pre : null;
    }
    if (choice == null && combinable(row) && included(row)) {
      const m: NewInstall = {
        id: newInstallChoice(row.matchKey),
        key: row.matchKey,
        wo: row.canonicalWo,
        account: row.fileCustomer!,
        customer: customerOf(row)?.trim() || row.customer,
        machines: row.namedMachines ?? null,
      };
      made.push(m);
      opener[i] = m;
    }
    return choice;
  });
  const siblingsOf = (i: number, id: number) =>
    rows
      .map((r, j) => ({ r, j }))
      .filter(({ r, j }) => j > i && targets[j] === id && included(r))
      .map(({ r }): InstallWo => ({ wo: r.canonicalWo, status: r.statusRaw, completedAt: r.completedAt }));
  return rows.map((row, i) => {
    if (!isInstallRow(row)) return row;
    const options = optionsOf[i]?.map((o) => {
      const state = o.id == null || o.newFrom ? null : stateOf(o.id, o.state);
      return !state ? o : { ...o, label: installOptionLabel(o.id!, o.summary, state, o.otherName) };
    }) ?? null;
    const id = targets[i]!;
    const option = options ? options.find((o) => o.id === id) ?? options.find((o) => o.id == null) : undefined;
    const base = id == null ? null : option?.newFrom ? sim.get(id) ?? null : options ? stateOf(id, option!.state) : stateOf(id, row.installState);
    if (id == null || !base) {
      if (!options && !opener[i] && !combinable(row)) return row;
      // A new install; one later rows go on is counted with their WOs, like any project.
      const later = opener[i] ? siblingsOf(i, opener[i]!.id) : [];
      const fresh = later.length
        ? installStatusFromCorrigo({ status: NEW_TICKET_STATUS.install, completedAt: null, wos: withSiblingWos([], later, row.matchKey) }, row)
        : { ...boardStatus("install", row.statusRaw, row.completedAt, null), completedAt: row.completedAt, wos: [] as InstallWo[] };
      if (opener[i] && included(row)) {
        sim.set(opener[i]!.id, { status: fresh.status, completedAt: fresh.completedAt, wos: withInstallWo([], row) });
      }
      return {
        ...row,
        installOptions: options,
        installChoice: null,
        installSiblings: later.length ? later : null,
        installNewFrom: null,
        action: "create",
        jobId: null,
        oldStatus: null,
        newStatus: fresh.status,
        statusUnmapped: fresh.unmapped,
        statusNote: fresh.note,
        oldCompletedAt: null,
        completedNote: unreadable(row),
        existingCustomer: null,
        customer: option?.customer ?? row.customer,
        byAccount: false,
        byEquipment: false,
      };
    }
    const siblings = siblingsOf(i, id);
    const next = installStatusFromCorrigo({ ...base, wos: withSiblingWos(base.wos, siblings, row.matchKey) }, row);
    if (included(row)) sim.set(id, { status: next.status, completedAt: next.completedAt, wos: withInstallWo(base.wos, row) });
    const held = next.wos.length > 1 && !!row.completedAt && next.date.change === null && next.status !== "Installed";
    return {
      ...row,
      installOptions: options,
      installChoice: options ? id : null,
      installSiblings: siblings.length ? siblings : null,
      installNewFrom: option?.newFrom ?? null,
      action: "update",
      jobId: option?.newFrom ? null : id,
      oldStatus: base.status,
      newStatus: next.status,
      statusUnmapped: next.unmapped,
      statusNote: next.note,
      oldCompletedAt: base.completedAt,
      completedNote: held ? `on ${row.canonicalWo} only — the install keeps ${base.completedAt || "no date"}` : unreadable(row),
      ...(options ? { existingCustomer: option!.customer, customer: option!.customer, byAccount: true, byEquipment: option!.byEquipment } : {}),
    };
  });
}

export function resolvePreviewRow(
  rec: CorrigoRecord,
  match: { unique: CorrigoHit | null; conflicts: CorrigoHit[] },
  opts: {
    wrapped?: boolean;
    today?: string;
    /** Open installs (WOs or not), and the equipment catalog, for an install row no WO matches. */
    installs?: OpenInstall[];
    catalog?: string[];
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
  const woHit = pickKeeper(preferFileCustomerInstalls(attachableHits(pool, rec.customer, wrapped, opts.today, rec), rec.customer), hinted);
  const pick = !woHit && hinted === "install" ? installCandidates(rec, opts.installs ?? [], opts.catalog ?? []) : null;
  const existing = woHit ?? pick?.choice ?? null;
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

  const row: CorrigoPreviewRow = {
    wo: rec.canonicalWo,
    rawWo: rec.rawWo,
    matchKey: rec.matchKey,
    canonicalWo: rec.canonicalWo,
    matchNote:
      [
        note,
        pick?.note,
        shared ?? (wrapRepeat ? wrapRepeatNote(rec.canonicalWo) : null),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    // An install picked by account keeps its own name ("Baldi Management Group Inc."), not the file's spelling.
    // A WO's install with the file's account (strict match) keeps its own spelling too.
    customer:
      pick?.choice
        ? pick.choice.customer
        : woHit?.board === "install" && customersStrictlyMatch(woHit.customer, rec.customer)
          ? woHit.customer
          : preferredImportCustomer(rec.customer, existing?.customer),
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
    byEquipment: !!pick?.choice && pick.byEquipment,
    byAccount: !!pick?.choice,
    installOptions: pick
      ? [
          ...pick.candidates.map((c): InstallOption => {
            const state = { status: c.status, completedAt: c.completedAt ?? null, wos: c.wos };
            const otherName = pick.strict.has(c.id) ? null : c.customer;
            return {
              id: c.id,
              label: installOptionLabel(c.id, c.summary, state, otherName),
              customer: c.customer,
              summary: c.summary,
              otherName,
              state,
              byEquipment: pick.byEquipment && pick.choice?.id === c.id,
            };
          }),
          {
            id: null,
            label: NEW_INSTALL_LABEL,
            customer: preferredImportCustomer(rec.customer, null),
            summary: "",
            state: null,
            byEquipment: false,
          },
        ]
      : null,
    installChoice: pick?.choice?.id ?? null,
    installPreselect: pick?.choice?.id ?? null,
    namedMachines:
      board === "install" && opts.catalog?.length
        ? rec.equipment?.trim()
          ? exactMachines([rec.equipment], opts.catalog)
          : spelledMachines(rec.issue ?? "", opts.catalog)
        : null,
    installState:
      woHit?.board === "install"
        ? { status: woHit.status, completedAt: woHit.completedAt ?? null, wos: woHit.wos ?? [] }
        : null,
  };
  // An install's other work orders decide what this one does to its status.
  return settleInstallRows([row])[0]!;
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
