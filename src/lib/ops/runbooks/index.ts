/** Bundled PM runbook definitions. Phase 1: files in this folder; a later phase moves them to the database. */
import { parseRunbookDefinition, type RunbookDefinition } from "../pm-runbook-schema.ts";
import { matchE4XWide } from "../pm-runbook.ts";
import {
  identifyBySerial,
  matchCameo,
  matchELine,
  matchEnigma,
  matchLegacyPlus,
  matchShotmaster,
  type RunbookHit,
} from "../pm-runbook-match.ts";
import cameo from "./eversys-cameo.json";
import e4xwide from "./eversys-e4-xwide.json";
import eline from "./eversys-eline.json";
import enigma from "./eversys-enigma.json";
import legacyPlus from "./eversys-legacy-plus.json";
import shotmaster from "./eversys-shotmaster.json";

export type RegisteredRunbook = {
  def: RunbookDefinition;
  /** Recognises a unit in free equipment text; `model` is a definition model id or null when the tech must pick. */
  matchPiece: (piece: string) => { model: string | null } | null;
};

const only = (fn: (piece: string) => RunbookHit | null) => (piece: string) => {
  const h = fn(piece);
  return h ? { model: h.model } : null;
};

/**
 * Order matters: the first runbook that recognises the text wins. X-Wide and Shotmaster come before the general
 * Enigma match ("E'4s X-Wide", "e'4 Shotmaster Pro"), and E'line before Enigma ("Eversys e'4s e'line").
 */
export const RUNBOOKS: RegisteredRunbook[] = [
  { def: parseRunbookDefinition(e4xwide), matchPiece: matchE4XWide },
  { def: parseRunbookDefinition(shotmaster), matchPiece: only(matchShotmaster) },
  { def: parseRunbookDefinition(cameo), matchPiece: only(matchCameo) },
  { def: parseRunbookDefinition(legacyPlus), matchPiece: only(matchLegacyPlus) },
  { def: parseRunbookDefinition(eline), matchPiece: only(matchELine) },
  { def: parseRunbookDefinition(enigma), matchPiece: only(matchEnigma) },
];

export function runbookById(id: string): RegisteredRunbook | undefined {
  return RUNBOOKS.find((r) => r.def.id === id);
}

export function runbookForPiece(piece: string): { runbook: RegisteredRunbook; model: string | null } | null {
  for (const runbook of RUNBOOKS) {
    const hit = runbook.matchPiece(piece);
    if (hit) return { runbook, model: hit.model };
  }
  return null;
}

/** Runbook id and model for a line of equipment text, or null when no runbook covers it. */
export function matchRunbookPiece(piece: string): RunbookHit | null {
  const r = runbookForPiece(piece);
  return r ? { runbookId: r.runbook.def.id, model: r.model } : null;
}

/** Runbook id and model from an Eversys serial, when its first 8 digits are listed and that runbook exists. */
export function matchRunbookSerial(serial: string | null | undefined): RunbookHit | null {
  const hit = identifyBySerial(serial);
  if (!hit || !runbookById(hit.runbookId)) return null;
  const def = runbookById(hit.runbookId)!.def;
  const model = hit.model && def.models.some((m) => m.id === hit.model) ? hit.model : null;
  return { runbookId: hit.runbookId, model };
}
