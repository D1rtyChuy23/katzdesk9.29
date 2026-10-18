/** Bundled PM runbook definitions. Phase 1: files in this folder; a later phase moves them to the database. */
import { parseRunbookDefinition, type RunbookDefinition } from "../pm-runbook-schema.ts";
import { matchE4XWide } from "../pm-runbook.ts";
import e4xwide from "./eversys-e4-xwide.json";
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

export const RUNBOOKS: RegisteredRunbook[] = [
  { def: parseRunbookDefinition(e4xwide), matchPiece: matchE4XWide, platforms: ["Enigma / e'Line"], modules: true },
  { def: parseRunbookDefinition(linea), matchPiece: matchLmLinea, platforms: [], modules: false },
  { def: parseRunbookDefinition(strada), matchPiece: matchLmStrada, platforms: [], modules: false },
  { def: parseRunbookDefinition(kb90), matchPiece: matchLmKb90, platforms: [], modules: false },
  { def: parseRunbookDefinition(gb5), matchPiece: matchLmGb5, platforms: [], modules: false },
  { def: parseRunbookDefinition(gs3), matchPiece: matchLmGs3, platforms: [], modules: false },
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
