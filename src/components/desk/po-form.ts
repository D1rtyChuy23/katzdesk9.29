import { useEffect, useState } from "react";
import { poToSend } from "@/lib/ops/ticket-po";

/**
 * What a Details form sends for its P.O. boxes: each one only when it reads differently from what the box was last given
 * (its defaultValue: what the record had when the form opened, or after a save). A locked box sends nothing.
 */
export function poFromForm(form: HTMLFormElement): { po?: string; vendorPo?: string } {
  const out: { po?: string; vendorPo?: string } = {};
  const box = (name: string): HTMLInputElement | null => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement && !el.disabled ? el : null;
  };
  const po = box("po");
  const poSent = po ? poToSend(po.value, po.defaultValue) : undefined;
  if (poSent !== undefined) out.po = poSent;
  const vendor = box("vendorPo");
  const vendorSent = vendor ? poToSend(vendor.value, vendor.defaultValue) : undefined;
  if (vendorSent !== undefined) out.vendorPo = vendorSent;
  return out;
}

/**
 * A controlled P.O. box (the rebuild sheet keeps its fields in state): it follows the record as the server has it until
 * it is changed here, and sends only a change (poToSend), so Save never puts back a P.O. the Invoice window set since.
 */
export function useSyncedPo(server: string | null | undefined, recordId: number | null) {
  const now = server ?? "";
  const [box, setBox] = useState({ id: recordId, value: now, base: now });
  useEffect(() => {
    setBox((cur) => {
      if (cur.id !== recordId) return { id: recordId, value: now, base: now };
      // Not changed here: it shows the record's. Changed here to what the record has now: nothing left to send.
      if (cur.value.trim() === cur.base.trim()) return { id: recordId, value: now, base: now };
      if (cur.value.trim() === now.trim()) return { id: recordId, value: cur.value, base: now };
      return cur;
    });
  }, [recordId, now]);
  return {
    value: box.id === recordId ? box.value : now,
    set: (value: string) => setBox((cur) => ({ ...cur, value })),
    /** What a save sends: the box when it was changed here, else undefined. */
    toSend: (): string | undefined => (box.id === recordId ? poToSend(box.value, box.base) : undefined),
  };
}
