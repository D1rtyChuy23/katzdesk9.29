/**
 * PM runbook — which runbook (and model) a unit needs, from its equipment text or its serial number.
 * Pure: no DOM, no database, safe for node --test.
 *
 * Text is how the PM job and the account list write the machine ("Eversys Cameo c'2s", "Shotmaster CT").
 * The serial is authoritative when there is one: Eversys serials start with 8 digits that name the exact
 * machine type (e'Support, "List of machine serial numbers - North America only").
 */

export type RunbookHit = { runbookId: string; model: string | null };

// ---------------- serial numbers ----------------

/** First 8 digits of an Eversys serial → runbook and model id. */
export const EVERSYS_SERIAL_PREFIXES: Record<string, RunbookHit & { type: string }> = {
  // Cameo
  "00998100": { runbookId: "eversys-cameo", model: "2c", type: "C'2c/Classic" },
  "00998200": { runbookId: "eversys-cameo", model: "2s", type: "C'2s/Classic" },
  "01831300": { runbookId: "eversys-cameo", model: "2s", type: "C'2s/Classic" },
  "00998300": { runbookId: "eversys-cameo", model: "2ms", type: "C'2ms/Classic" },
  "01833300": { runbookId: "eversys-cameo", model: "2ms", type: "C'2ms/Classic" },
  "01139400": { runbookId: "eversys-cameo", model: "2c", type: "C'2c/Core" },
  "01138900": { runbookId: "eversys-cameo", model: "2s", type: "C'2s/Core" },
  "01092600": { runbookId: "eversys-cameo", model: "2ms", type: "C'2ms/Core" },
  "01147000": { runbookId: "eversys-cameo", model: "2c", type: "C'2c/ST" },
  "01146900": { runbookId: "eversys-cameo", model: "2s", type: "C'2s/ST" },
  "01146800": { runbookId: "eversys-cameo", model: "2ms", type: "C'2ms/ST" },
  "01063900": { runbookId: "eversys-cameo", model: "2s", type: "C'2s Cameo X" },
  "01031100": { runbookId: "eversys-cameo", model: "2ms", type: "C'2ms Cameo X" },
  "01031200": { runbookId: "eversys-cameo", model: "2ms", type: "C'2ms test station" },
  // Enigma Classic
  "01106800": { runbookId: "eversys-enigma", model: "2c", type: "E'2c/Classic" },
  "01106900": { runbookId: "eversys-enigma", model: "2s", type: "E'2s/Classic" },
  "01108400": { runbookId: "eversys-enigma", model: "2ms", type: "E'2ms/Classic" },
  "01107000": { runbookId: "eversys-enigma", model: "4s", type: "E'4s/Classic" },
  "01107100": { runbookId: "eversys-enigma", model: "4ms", type: "E'4ms/Classic" },
  "01107200": { runbookId: "eversys-e4-xwide", model: "4s", type: "E'4s X-Wide/Classic" },
  "01107300": { runbookId: "eversys-e4-xwide", model: "4ms", type: "E'4ms X-Wide/Classic" },
  "01159800": { runbookId: "eversys-enigma", model: "6s", type: "E'6s/Classic" },
  "01159900": { runbookId: "eversys-enigma", model: "6ms", type: "E'6ms/Classic" },
  "01153900": { runbookId: "eversys-shotmaster", model: "c", type: "Shotmaster c/Classic" },
  "01160000": { runbookId: "eversys-shotmaster", model: "s", type: "Shotmaster s/Classic" },
  "01160100": { runbookId: "eversys-shotmaster", model: "ms", type: "Shotmaster ms/Classic" },
  // Enigma ST
  "01165300": { runbookId: "eversys-enigma", model: "2c", type: "E'2c/ST" },
  "01165400": { runbookId: "eversys-enigma", model: "2s", type: "E'2s/ST" },
  "01165500": { runbookId: "eversys-enigma", model: "2ms", type: "E'2ms/ST" },
  "01165600": { runbookId: "eversys-enigma", model: "4s", type: "E'4s/ST" },
  "01165700": { runbookId: "eversys-enigma", model: "4ms", type: "E'4ms/ST" },
  "01166000": { runbookId: "eversys-e4-xwide", model: "4s", type: "E'4s X-Wide/ST" },
  "01166100": { runbookId: "eversys-e4-xwide", model: "4ms", type: "E'4ms X-Wide/ST" },
  "01165800": { runbookId: "eversys-enigma", model: "6s", type: "E'6s/ST" },
  "01165900": { runbookId: "eversys-enigma", model: "6ms", type: "E'6ms/ST" },
  "01166200": { runbookId: "eversys-shotmaster", model: "c", type: "Shotmaster c/ST" },
  "01166300": { runbookId: "eversys-shotmaster", model: "s", type: "Shotmaster s/ST" },
  "01166400": { runbookId: "eversys-shotmaster", model: "ms", type: "Shotmaster ms/ST" },
  "01166500": { runbookId: "eversys-shotmaster", model: "spro", type: "Shotmaster s-pro/ST" },
  "01166600": { runbookId: "eversys-shotmaster", model: "mspro", type: "Shotmaster ms-pro/ST" },
  // E'line (older generation)
  "00999400": { runbookId: "eversys-eline", model: "2c", type: "E'2c (E'line)" },
  "00999100": { runbookId: "eversys-eline", model: "2s", type: "E'2s (E'line)" },
  "00998500": { runbookId: "eversys-eline", model: "2ms", type: "E'2ms (E'line)" },
  "00998600": { runbookId: "eversys-eline", model: "4s", type: "E'4s (E'line)" },
  "00998700": { runbookId: "eversys-eline", model: "4ms", type: "E'4ms (E'line)" },
  "00999500": { runbookId: "eversys-eline", model: "4s", type: "E'4s self-service (E'line); kits taken as E'4s" },
  "00999600": { runbookId: "eversys-eline", model: "4ms", type: "E'4ms self-service (E'line)" },
  "00999700": { runbookId: "eversys-eline", model: "6s", type: "E'6s (E'line)" },
  "00999800": { runbookId: "eversys-eline", model: "6ms", type: "E'6ms (E'line)" },
  "00999300": { runbookId: "eversys-eline", model: "shot", type: "Shotmaster (E'line)" },
  // Legacy+
  "01344800": { runbookId: "eversys-legacy-plus", model: "2c", type: "L'2c" },
  "01344900": { runbookId: "eversys-legacy-plus", model: "2m", type: "L'2m" },
};

/** First 6 digits → entry, for serials whose digits 7–8 aren't "00" ("0183330226105C0012"). Every 6-digit prefix is unique. */
const BY_SIX = new Map<string, RunbookHit & { type: string }>(
  Object.entries(EVERSYS_SERIAL_PREFIXES).map(([k, v]) => [k.slice(0, 6), v]),
);

function prefixHit(digits: string): (RunbookHit & { type: string }) | null {
  if (digits.length < 8) return null;
  return EVERSYS_SERIAL_PREFIXES[digits.slice(0, 8)] ?? BY_SIX.get(digits.slice(0, 6)) ?? null;
}

/**
 * Runbook and model from an Eversys serial ("0115390026159E0001" → Shotmaster c). Null for any serial whose first
 * digits are not on the list. A spreadsheet may have dropped the leading zero ("1166000250770"): the zero is put
 * back only for a full-length serial (12+ digits), not for another maker's short one ("1107000").
 * Callers apply it only to a unit the text already calls an Eversys (see matchRunbookSerial).
 */
export function identifyBySerial(serial: string | null | undefined): (RunbookHit & { type: string }) | null {
  const raw = String(serial ?? "").replace(/^\s*(?:s\s*\/?\s*n|serial(?:\s*(?:no\.?|number|#))?)\s*[:#.]?\s*/i, "");
  const lead = /^\s*(\d+)/.exec(raw)?.[1] ?? "";
  if (lead[0] === "0") return prefixHit(lead);
  if (lead.length >= 12) return prefixHit(`0${lead}`);
  return null;
}

// ---------------- equipment text ----------------

const E = "e[’'`]?\\s?"; // e'4, e’4, E4, e 4
const C = "c[’'`]?\\s?"; // c'2, C2
const L = "l[’'`]?\\s?"; // L'2
const LINE = "\\be[’'`-]?\\s?line\\b"; // e'line, E-line, Eline

/** A fridge or a "need a loaner" note is not a machine with a PM. */
const notAMachine = (t: string) => /fridge|loaner/i.test(t);

/** Eversys Shotmaster (Enigma range). "Shotmaster CT" is how Katz writes the coffee-only Shotmaster c. */
export function matchShotmaster(piece: string): RunbookHit | null {
  const t = piece.trim();
  if (!/shot\s?-?master/i.test(t) || notAMachine(t)) return null;
  if (new RegExp(LINE, "i").test(t)) return null; // the E'line Shotmaster is on the E'line runbook
  if (/\bms\s*[/-]?\s*pro\b|\bm\s*[/-]\s*pro\b/i.test(t)) return { runbookId: "eversys-shotmaster", model: "mspro" };
  if (/\bs\s*[/-]\s*pro\b|\bs-?pro\b/i.test(t)) return { runbookId: "eversys-shotmaster", model: "spro" };
  if (/\bpro\b/i.test(t)) return { runbookId: "eversys-shotmaster", model: null };
  const rest = t.replace(/^.*shot\s?-?master/i, " ");
  if (/\bct\b|\bc\b/i.test(rest)) return { runbookId: "eversys-shotmaster", model: "c" };
  if (/\bms\b|\bm\b/i.test(rest)) return { runbookId: "eversys-shotmaster", model: "ms" };
  if (/\bs\b/i.test(rest)) return { runbookId: "eversys-shotmaster", model: "s" };
  return { runbookId: "eversys-shotmaster", model: null };
}

/** Eversys Cameo: "Cameo", "Eversys Cameo c'2s", "Cameo C2's", "cameo C2M". */
export function matchCameo(piece: string): RunbookHit | null {
  const t = piece.trim();
  if (notAMachine(t)) return null;
  const named = /\bcameo\b/i.test(t);
  const code = new RegExp(`\\b${C}2\\s?[’'\`]?\\s?(ms|m|s|c|ct)\\b`, "i").exec(t);
  if (!named && !code) return null;
  if (!named && !/eversys/i.test(t)) return null; // a bare "C2s" could be another maker
  const v = code?.[1]?.toLowerCase();
  const model = v === "ms" || v === "m" ? "2ms" : v === "s" ? "2s" : v === "c" || v === "ct" ? "2c" : null;
  return { runbookId: "eversys-cameo", model };
}

/** Eversys Legacy+ (L'2c, L'2m). Legacy Steam (L'2s) has no PM manual, so it is not matched. */
export function matchLegacyPlus(piece: string): RunbookHit | null {
  const t = piece.trim();
  const code = new RegExp(`\\b${L}2\\s?[’'\`]?\\s?(c|m|s)\\b`, "i").exec(t);
  if (notAMachine(t)) return null;
  // "Legacy" alone, "Eversys Legacy", "Legacy+" or an L'2 code; not any text starting "Legacy " ("Legacy Lounge Bunn").
  const named = /^(eversys\s+)?legacy\s*\+?$/i.test(t) || /eversys\s+legacy/i.test(t) || /legacy\s*\+/i.test(t);
  if (!named && !code) return null;
  if (/legacy\s+steam/i.test(t) || code?.[1]?.toLowerCase() === "s") return null;
  const v = code?.[1]?.toLowerCase();
  return { runbookId: "eversys-legacy-plus", model: v === "c" ? "2c" : v === "m" ? "2m" : null };
}

function enigmaModel(t: string): string | null {
  const m = new RegExp(`\\b${E}([246])\\s?[’'\`]?\\s?(ms|m|s|ct|c)?\\b`, "i").exec(t);
  if (!m) return null;
  const size = m[1];
  const v = (m[2] ?? "").toLowerCase();
  if (v === "ms" || v === "m") return `${size}ms`;
  if (v === "s") return `${size}s`;
  if (v === "c" || v === "ct") return size === "2" ? "2c" : null;
  return null;
}

/** Older E'line generation: the text says e'line ("Eversys e'4s e'line", "E'line E4", "E-line e'4s", "E'line Shotmaster"). */
export function matchELine(piece: string): RunbookHit | null {
  const t = piece.trim();
  if (!new RegExp(LINE, "i").test(t) || notAMachine(t)) return null;
  if (/x[\s-]?(tra)?\s?wide/i.test(t)) return null;
  if (/shot\s?-?master/i.test(t)) return { runbookId: "eversys-eline", model: "shot" };
  const rest = t.replace(new RegExp(LINE, "ig"), " ");
  if (!new RegExp(`\\b${E}[246]`, "i").test(rest)) return null;
  return { runbookId: "eversys-eline", model: enigmaModel(rest) };
}

/** Current Enigma e'2 / e'4 / e'6 (not X-Wide, not Shotmaster, not E'line). */
export function matchEnigma(piece: string): RunbookHit | null {
  const t = piece.trim();
  if (/x[\s-]?(tra)?\s?wide/i.test(t)) return null; // X-Wide has its own runbook
  if (/shot\s?-?master/i.test(t) || new RegExp(LINE, "i").test(t) || notAMachine(t)) return null;
  const code = new RegExp(`\\b${E}[246]\\s?[’'\`]?\\s?(ms|m|s|ct|c)?\\b`, "i").exec(t);
  // "Enigma" or "Eversys Enigma" with no size: the Enigma runbook, the tech picks the model.
  if (!code) return /\benigma\b/i.test(t) ? { runbookId: "eversys-enigma", model: null } : null;
  // A bare "E4" alone is too loose; it needs "Eversys"/"Enigma", an apostrophe (e'4) or a model letter (E4s).
  const strong = /eversys|enigma/i.test(t) || /[’'`]/.test(code[0]) || !!code[1];
  if (!strong) return null;
  return { runbookId: "eversys-enigma", model: enigmaModel(t) };
}
