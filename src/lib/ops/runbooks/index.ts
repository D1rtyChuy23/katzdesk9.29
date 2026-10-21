/** Bundled PM runbook definitions. Phase 1: files in this folder; a later phase moves them to the database. */
import { parseRunbookDefinition, type RunbookDefinition } from "../pm-runbook-schema.ts";
import { matchE4XWide } from "../pm-runbook.ts";
import { matchFaemaX20, matchSego12 } from "./faema-bravilor-match.ts";
import {
  identifyBySerial,
  matchCameo,
  matchELine,
  matchEnigma,
  matchLegacyPlus,
  matchShotmaster,
  type RunbookHit,
} from "../pm-runbook-match.ts";
import sego12 from "./bravilor-sego12.json";
import cameo from "./eversys-cameo.json";
import e4xwide from "./eversys-e4-xwide.json";
import eline from "./eversys-eline.json";
import enigma from "./eversys-enigma.json";
import legacyPlus from "./eversys-legacy-plus.json";
import shotmaster from "./eversys-shotmaster.json";
import x20 from "./faema-x20.json";
import gb5 from "./la-marzocco-gb5.json";
import gs3 from "./la-marzocco-gs3.json";
import kb90 from "./la-marzocco-kb90.json";
import linea from "./la-marzocco-linea.json";
import { matchLmGb5, matchLmGs3, matchLmKb90, matchLmLinea, matchLmStrada } from "./la-marzocco-match.ts";
import strada from "./la-marzocco-strada.json";

export type RegisteredRunbook = {
  def: RunbookDefinition;
  /** Recognises a unit in free equipment text; `model` is a definition model id or null when the tech must pick. */
  matchPiece: (piece: string) => { model: string | null } | null;
  /** Module platforms this machine uses. Others are refused with a reason. Empty when `modules` is false. */
  platforms: readonly string[];
  /** False when the machine does not take swappable Eversys modules. */
  modules: boolean;
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
  { def: parseRunbookDefinition(e4xwide), matchPiece: matchE4XWide, platforms: ["Enigma / e'Line"], modules: true },
  { def: parseRunbookDefinition(shotmaster), matchPiece: only(matchShotmaster), platforms: ["Enigma / e'Line"], modules: true },
  { def: parseRunbookDefinition(cameo), matchPiece: only(matchCameo), platforms: ["Cameo"], modules: true },
  { def: parseRunbookDefinition(legacyPlus), matchPiece: only(matchLegacyPlus), platforms: ["Legacy"], modules: true },
  { def: parseRunbookDefinition(eline), matchPiece: only(matchELine), platforms: ["Enigma / e'Line"], modules: true },
  { def: parseRunbookDefinition(enigma), matchPiece: only(matchEnigma), platforms: ["Enigma / e'Line"], modules: true },
  { def: parseRunbookDefinition(linea), matchPiece: matchLmLinea, platforms: [], modules: false },
  { def: parseRunbookDefinition(strada), matchPiece: matchLmStrada, platforms: [], modules: false },
  { def: parseRunbookDefinition(kb90), matchPiece: matchLmKb90, platforms: [], modules: false },
  { def: parseRunbookDefinition(gb5), matchPiece: matchLmGb5, platforms: [], modules: false },
  { def: parseRunbookDefinition(gs3), matchPiece: matchLmGs3, platforms: [], modules: false },
  { def: parseRunbookDefinition(x20), matchPiece: matchFaemaX20, platforms: [], modules: false },
  { def: parseRunbookDefinition(sego12), matchPiece: matchSego12, platforms: [], modules: false },
];

export function runbookById(id: string): RegisteredRunbook | undefined {
  return RUNBOOKS.find((r) => r.def.id === id);
}

export function runbookForPlatform(platform: string | null | undefined): RegisteredRunbook | null {
  if (!platform) return null;
  return RUNBOOKS.find((r) => r.platforms.includes(platform)) ?? null;
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
