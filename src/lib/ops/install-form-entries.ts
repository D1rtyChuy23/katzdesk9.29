/**
 * What the tech fills in on the Equipment Request Form in KatzDesk (Chuy, 10/24: "only the tech's parts"): the Done
 * ticks and notes on the three checklists, who verified the pre-installation checklist and when, the six Tech notes
 * boxes, and the sign-off. Customer, contact and equipment stay read-only on the form: they're changed in the install
 * window. One JSON per install (install_form_entries); the page, print and the PDF all read it through these helpers.
 *
 * Signing stamps the signed-in person and the time; only the owner approves, after the technician has signed, and an
 * approved form is final until the owner undoes the approval.
 */
import { CHECKLIST_LABELS } from "./install-form.ts";

export type ChecklistKey = keyof typeof CHECKLIST_LABELS;
export const CHECKLISTS = Object.keys(CHECKLIST_LABELS) as ChecklistKey[];

/** The Tech notes box at the end of each section of the form, in the form's order. */
export const TECH_NOTE_SECTIONS = [
  { key: "account", title: "Account & install" },
  { key: "equipment", title: "Equipment to install" },
  { key: "pre", title: "Pre-installation checklist" },
  { key: "tasks", title: "Installation tasks" },
  { key: "corrigo", title: "Corrigo account update tasks" },
  { key: "signoff", title: "Sign-off" },
] as const;
export type TechNoteKey = (typeof TECH_NOTE_SECTIONS)[number]["key"];
const TECH_NOTE_KEYS = new Set<string>(TECH_NOTE_SECTIONS.map((s) => s.key));

/** Who signed or approved, and when (ISO time). */
export type FormStamp = { by: string; at: string };

export type FormEntries = {
  /** Lines ticked Done, by entryKey ("tasks:parameters-recorded"). */
  done: Record<string, true>;
  /** The tech's note on a line, by entryKey. It replaces what KatzDesk shows there. */
  notes: Record<string, string>;
  techNotes: Partial<Record<TechNoteKey, string>>;
  /** The pre-installation checklist's "Verified by" and date (YYYY-MM-DD); blank shows the inspector's. */
  verifiedBy: string | null;
  verifiedOn: string | null;
  /** The technician's name in the sign-off; blank shows the install's tech. */
  techName: string | null;
  completedOn: string | null;
  signed: FormStamp | null;
  approved: FormStamp | null;
  approvedOn: string | null;
};

/** A line's note fits its cell on the form; a Tech notes box takes a short paragraph. */
export const NOTE_MAX = 120;
export const TECH_NOTE_MAX = 1000;
export const NAME_MAX = 80;

/** "Cold water source confirmed" → "cold-water-source-confirmed". */
export function lineKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function entryKey(list: ChecklistKey, label: string): string {
  return `${list}:${lineKey(label)}`;
}

const KNOWN_LINES = new Set(CHECKLISTS.flatMap((list) => CHECKLIST_LABELS[list].map((label) => entryKey(list, label))));

export function isEntryKey(key: string): boolean {
  return KNOWN_LINES.has(key);
}

export function emptyEntries(): FormEntries {
  return {
    done: {},
    notes: {},
    techNotes: {},
    verifiedBy: null,
    verifiedOn: null,
    techName: null,
    completedOn: null,
    signed: null,
    approved: null,
    approvedOn: null,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayOk(v);
function dayOk(v: string): boolean {
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}
function stampOf(v: unknown): FormStamp | null {
  if (!isObject(v)) return null;
  const by = str(v.by);
  const at = str(v.at);
  return by && at ? { by, at } : null;
}

/** The stored JSON, read leniently: anything unknown or malformed is left out. */
export function readEntries(raw: unknown): FormEntries {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  const out = emptyEntries();
  if (!isObject(v)) return out;
  if (isObject(v.done)) for (const [k, on] of Object.entries(v.done)) if (on === true && isEntryKey(k)) out.done[k] = true;
  if (isObject(v.notes)) for (const [k, text] of Object.entries(v.notes)) if (isEntryKey(k) && str(text)) out.notes[k] = String(text);
  if (isObject(v.techNotes)) {
    for (const [k, text] of Object.entries(v.techNotes)) if (TECH_NOTE_KEYS.has(k) && str(text)) out.techNotes[k as TechNoteKey] = String(text);
  }
  out.verifiedBy = str(v.verifiedBy);
  out.verifiedOn = isDay(v.verifiedOn) ? v.verifiedOn : null;
  out.techName = str(v.techName);
  out.completedOn = isDay(v.completedOn) ? v.completedOn : null;
  out.signed = stampOf(v.signed);
  out.approved = stampOf(v.approved);
  out.approvedOn = isDay(v.approvedOn) ? v.approvedOn : null;
  return out;
}

/** What one Save sends: only what changed. A null or blank value takes the tech's entry off. */
export type FormPatch = {
  done?: Record<string, boolean>;
  notes?: Record<string, string | null>;
  techNotes?: Partial<Record<TechNoteKey, string | null>>;
  verifiedBy?: string | null;
  verifiedOn?: string | null;
  techName?: string | null;
  completedOn?: string | null;
  approvedOn?: string | null;
  /** true: the signed-in person signs as the technician now. false: the signature comes off. */
  sign?: boolean;
  /** true: the owner approves now. false: the owner undoes the approval. */
  approve?: boolean;
};

/** Who is saving: their KatzDesk name, whether they are the owner, the time, and today's date in Chicago. */
export type FormActor = { name: string; owner: boolean; now: Date; today: string };

const line = (v: string | null | undefined) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
const paragraph = (v: string | null | undefined) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function dayIn(v: string | null | undefined, what: string): string | null {
  const s = line(v);
  if (!s) return null;
  if (!isDay(s)) throw new Error(`${what} isn't a date.`);
  return s;
}
function nameIn(v: string | null | undefined, what: string): string | null {
  const s = line(v);
  if (s.length > NAME_MAX) throw new Error(`${what} is too long: ${NAME_MAX} characters at most.`);
  return s || null;
}

function changesFields(p: FormPatch): boolean {
  return (
    !!(p.done && Object.keys(p.done).length) ||
    !!(p.notes && Object.keys(p.notes).length) ||
    !!(p.techNotes && Object.keys(p.techNotes).length) ||
    p.verifiedBy !== undefined ||
    p.verifiedOn !== undefined ||
    p.techName !== undefined ||
    p.completedOn !== undefined ||
    p.approvedOn !== undefined ||
    p.sign !== undefined
  );
}

/** The entries after one Save, or an error that says why it can't be saved. Nothing else changes. */
export function applyFormPatch(cur: FormEntries, patch: FormPatch, actor: FormActor): FormEntries {
  const next: FormEntries = {
    ...cur,
    done: { ...cur.done },
    notes: { ...cur.notes },
    techNotes: { ...cur.techNotes },
  };
  // An approved form is final. Only the owner undoes the approval, and then it can change again.
  if (patch.approve === false) {
    if (next.approved && !actor.owner) throw new Error("Only the owner can undo the approval.");
    next.approved = null;
    next.approvedOn = null;
  }
  if (next.approved && changesFields(patch)) {
    throw new Error(`Approved by ${next.approved.by}: the form is final. The owner can undo the approval to change it.`);
  }

  for (const [key, on] of Object.entries(patch.done ?? {})) {
    if (!isEntryKey(key)) throw new Error("That checklist line isn't on the form.");
    if (on) next.done[key] = true;
    else delete next.done[key];
  }
  for (const [key, raw] of Object.entries(patch.notes ?? {})) {
    if (!isEntryKey(key)) throw new Error("That checklist line isn't on the form.");
    const text = line(raw);
    if (text.length > NOTE_MAX) throw new Error(`A checklist note is too long: ${NOTE_MAX} characters at most.`);
    if (text) next.notes[key] = text;
    else delete next.notes[key];
  }
  for (const [key, raw] of Object.entries(patch.techNotes ?? {})) {
    if (!TECH_NOTE_KEYS.has(key)) throw new Error("That Tech notes box isn't on the form.");
    const text = paragraph(raw);
    if (text.length > TECH_NOTE_MAX) throw new Error(`Tech notes are too long: ${TECH_NOTE_MAX} characters at most.`);
    if (text) next.techNotes[key as TechNoteKey] = text;
    else delete next.techNotes[key as TechNoteKey];
  }
  if (patch.verifiedBy !== undefined) next.verifiedBy = nameIn(patch.verifiedBy, "Verified by");
  if (patch.verifiedOn !== undefined) next.verifiedOn = dayIn(patch.verifiedOn, "The verified date");
  if (patch.techName !== undefined) next.techName = nameIn(patch.techName, "The technician's name");
  if (patch.completedOn !== undefined) next.completedOn = dayIn(patch.completedOn, "Date completed");

  if (patch.sign === false && next.signed) {
    if (next.signed.by !== actor.name && !actor.owner) throw new Error(`Only ${next.signed.by} or the owner can take the signature off.`);
    next.signed = null;
  }
  if (patch.sign === true) {
    if (next.signed && next.signed.by !== actor.name && !actor.owner) {
      throw new Error(`Signed by ${next.signed.by}: only ${next.signed.by} or the owner can change the signature.`);
    }
    next.signed = { by: actor.name, at: actor.now.toISOString() };
    next.completedOn ??= actor.today;
  }

  if (patch.approvedOn !== undefined || patch.approve === true) {
    if (!actor.owner) throw new Error("Only the owner can approve the form.");
  }
  if (patch.approve === true) {
    if (!next.signed) throw new Error("The technician signs first.");
    next.approved = { by: actor.name, at: actor.now.toISOString() };
  }
  if (patch.approvedOn !== undefined) next.approvedOn = dayIn(patch.approvedOn, "Date approved");
  if (patch.approve === true) next.approvedOn ??= actor.today;
  if (next.approvedOn && !next.approved) throw new Error("Approve the form first.");
  return next;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The history line for one Save: "Equipment form: 3 ticked done · 1 note · Tech notes (Sign-off) · signed by melinda". */
export function describeFormChange(before: FormEntries, after: FormEntries): string | null {
  const parts: string[] = [];
  const ticked = Object.keys(after.done).filter((k) => !before.done[k]).length;
  const unticked = Object.keys(before.done).filter((k) => !after.done[k]).length;
  if (ticked) parts.push(`${ticked} ticked done`);
  if (unticked) parts.push(`${unticked} unticked`);
  const keys = new Set([...Object.keys(before.notes), ...Object.keys(after.notes)]);
  const notes = [...keys].filter((k) => before.notes[k] !== after.notes[k]).length;
  if (notes) parts.push(`${notes} ${notes === 1 ? "note" : "notes"}`);
  const boxes = TECH_NOTE_SECTIONS.filter((s) => before.techNotes[s.key] !== after.techNotes[s.key]).map((s) => s.title);
  if (boxes.length) parts.push(`Tech notes (${boxes.join(", ")})`);
  if (before.verifiedBy !== after.verifiedBy || before.verifiedOn !== after.verifiedOn) parts.push("verified by / date");
  if (before.techName !== after.techName) parts.push(after.techName ? `technician ${after.techName}` : "technician name cleared");
  if (before.completedOn !== after.completedOn) parts.push(after.completedOn ? `completed ${after.completedOn}` : "date completed cleared");
  if (!same(before.signed, after.signed)) parts.push(after.signed ? `signed by ${after.signed.by}` : "signature taken off");
  if (!same(before.approved, after.approved)) parts.push(after.approved ? `approved by ${after.approved.by}` : "approval undone");
  else if (before.approvedOn !== after.approvedOn) parts.push(after.approvedOn ? `approved ${after.approvedOn}` : "date approved cleared");
  return parts.length ? `Equipment form: ${parts.join(" · ")}` : null;
}

/** "melinda · Oct 24, 2026, 10:42 AM" (Chicago time). */
export function stampText(stamp: FormStamp): string {
  const at = new Date(stamp.at);
  if (Number.isNaN(at.getTime())) return stamp.by;
  const when = at.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${stamp.by} · ${when}`;
}

/** A line's note as the form shows it: the tech's, else KatzDesk's. */
export function lineNote(entries: FormEntries | null | undefined, list: ChecklistKey, label: string, katzDesk: string): string {
  return entries?.notes[entryKey(list, label)] ?? katzDesk;
}

export function lineDone(entries: FormEntries | null | undefined, list: ChecklistKey, label: string): boolean {
  return !!entries?.done[entryKey(list, label)];
}
