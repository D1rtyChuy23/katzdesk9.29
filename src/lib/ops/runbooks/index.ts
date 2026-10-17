/** Bundled PM runbook definitions. Phase 1: files in this folder; a later phase moves them to the database. */
import { parseRunbookDefinition, type RunbookDefinition } from "../pm-runbook-schema.ts";
import { matchE4XWide } from "../pm-runbook.ts";
import e4xwide from "./eversys-e4-xwide.json";

export type RegisteredRunbook = {
  def: RunbookDefinition;
  /** Recognises a unit in free equipment text; `model` is a definition model id or null when the tech must pick. */
  matchPiece: (piece: string) => { model: string | null } | null;
  /** Module platforms this machine uses. Others are refused with a reason. */
  platforms: readonly string[];
};

export const RUNBOOKS: RegisteredRunbook[] = [
  { def: parseRunbookDefinition(e4xwide), matchPiece: matchE4XWide, platforms: ["Enigma / e'Line"] },
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
