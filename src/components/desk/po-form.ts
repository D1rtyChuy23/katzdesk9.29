import { useEffect, useState } from "react";
import { poToSend, syncPoBox } from "@/lib/ops/ticket-po";

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
 * window, a merge, an import). `key` is the record the box is for: another record starts it over.
 */
export function useSyncedPo(server: string | null | undefined, key: string | number | null) {
  const now = server ?? "";
  const [box, setBox] = useState({ key, value: now, base: now });
  useEffect(() => setBox((cur) => syncPoBox(cur, key, now)), [key, now]);
  const mine = box.key === key;
  return {
    value: mine ? box.value : now,
    /** The record's P.O. as the box last took it: what a save compares the box with. */
    base: mine ? box.base : now,
    set: (value: string) => setBox((cur) => (cur.key === key ? { ...cur, value } : { key, value, base: now })),
    /** What a save sends: the box when it was changed here, else undefined. */
    toSend: (): string | undefined => (mine ? poToSend(box.value, box.base) : undefined),
  };
}
