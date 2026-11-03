import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { poToSend, syncPoBox } from "@/lib/ops/ticket-po";

type SavedPo = { id: number; po: string | null; vendorPo: string | null };
const LIST_KEY = { pm: "pms", install: "installs", deal: "deals", rebuild: "rebuilds" } as const;

/**
 * After a PM's, install's or deal's Details save, its P.O.s as stored go at once into every list its sheet may have been
 * opened from (its board, a PM opened from its ticket, an account's history): each box takes what was saved as its base
 * right away, not only when those lists read again, so a P.O. approved in the Invoice window meanwhile isn't put back by
 * the sheet's save on close (11/2).
 */
export function holdSavedPo(qc: QueryClient, kind: keyof typeof LIST_KEY, saved: SavedPo | null | undefined): void {
  if (!saved) return;
  const patch = <T,>(r: T): T =>
    r && typeof r === "object" && (r as { id?: unknown }).id === saved.id ? { ...r, po: saved.po, vendorPo: saved.vendorPo } : r;
  qc.setQueriesData({ queryKey: [LIST_KEY[kind]] }, (old: unknown) => {
    if (Array.isArray(old)) return old.map(patch);
    // The rebuild board keeps its rows with what the viewer may do ({ rows, canEdit, accountLock }).
    const rows = old && typeof old === "object" ? (old as { rows?: unknown }).rows : null;
    return Array.isArray(rows) ? { ...(old as object), rows: rows.map(patch) } : old;
  });
  if (kind === "pm") qc.setQueryData(["pm", saved.id], (old: unknown) => patch(old));
  qc.setQueriesData({ queryKey: ["customer-history"] }, (old: unknown) => {
    const list = old && typeof old === "object" ? (old as Record<string, unknown>)[LIST_KEY[kind]] : null;
    return Array.isArray(list) ? { ...(old as object), [LIST_KEY[kind]]: list.map(patch) } : old;
  });
}

/**
 * What a Details form sends for its P.O. boxes (PoFields): each one only when it reads differently from its base, the
 * record's P.O. as the box last took it (data-base); a locked box sends nothing. The base is kept in state, not read
 * from the input's defaultValue: React writes a box's starting value into the input, which counts as typed in it, so
 * its defaultValue would move to a P.O. set elsewhere (the Invoice window) while the box still shows the older one.
 */
export function poFromForm(form: HTMLFormElement): { po?: string; vendorPo?: string } {
  const out: { po?: string; vendorPo?: string } = {};
  const sent = (name: string): string | undefined => {
    const el = form.elements.namedItem(name);
    if (!(el instanceof HTMLInputElement) || el.disabled) return undefined;
    return poToSend(el.value, el.getAttribute("data-base") ?? "");
  };
  const po = sent("po");
  if (po !== undefined) out.po = po;
  const vendorPo = sent("vendorPo");
  if (vendorPo !== undefined) out.vendorPo = vendorPo;
  return out;
}

/**
 * One P.O. box's state (11/2): it follows the record as the server has it until it is changed here, and a save sends it
 * only when it was changed (poToSend), so a sheet left open never puts back a P.O. set elsewhere since (the Invoice
 * window, a merge, an import). `key` is the record the box is for: another record starts it over. A locked box (a ticket
 * billed or invoiced meanwhile) drops what was typed and shows the record's, so nothing refused is shown or sent later.
 */
export function useSyncedPo(server: string | null | undefined, key: string | number | null, locked = false) {
  const now = server ?? "";
  const [box, setBox] = useState({ key, value: now, base: now });
  useEffect(() => setBox((cur) => syncPoBox(cur, key, now, locked)), [key, now, locked]);
  const mine = box.key === key && !locked;
  return {
    value: mine ? box.value : now,
    /** The record's P.O. as the box last took it: what a save compares the box with. */
    base: mine ? box.base : now,
    set: (value: string) => setBox((cur) => (cur.key === key ? { ...cur, value } : { key, value, base: now })),
    /** What a save sends: the box when it was changed here, else undefined. */
    toSend: (): string | undefined => (mine ? poToSend(box.value, box.base) : undefined),
  };
}
