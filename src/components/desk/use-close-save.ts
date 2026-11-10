import { useRef } from "react";
import { toast } from "sonner";
import { CLOSE_UNSAVED, closeDecision } from "@/lib/ops/close-save";

/**
 * Save-on-close for one record's window (Chuy, 11/9): reads what the window would save when its form first shows,
 * and on close saves only if that changed. `record` is the record's id, so a window reused for another record
 * starts over.
 */
export function useCloseSave(record: string | number | null | undefined) {
  const baseline = useRef<{ record: string | number; value: string } | null>(null);
  const warned = useRef<string | number | null>(null);
  const base = () => (record != null && baseline.current?.record === record ? baseline.current.value : null);
  return {
    /** Call after each render: the first time this record's form is up, what it holds is the baseline. */
    read(form: HTMLFormElement | null, now: (form: HTMLFormElement) => string) {
      if (record == null || !form || base() != null) return;
      baseline.current = { record, value: now(form) };
    },
    /** A save went through: what it sent is the baseline now. */
    saved(value: string) {
      if (record != null) baseline.current = { record, value };
    },
    /** Close the window: save first when something changed; stay open, once, when the change can't save. */
    closeWindow(a: { form: HTMLFormElement | null; now: (form: HTMLFormElement) => string; save: () => void; close: () => void }) {
      if (!a.form) return a.close();
      const decision = closeDecision({ baseline: base(), now: a.now(a.form), valid: a.form.checkValidity(), warned: warned.current === record });
      if (decision === "warn") {
        warned.current = record ?? null;
        a.form.reportValidity();
        toast.error(CLOSE_UNSAVED);
        return;
      }
      warned.current = null;
      if (decision === "save") a.save();
      a.close();
    },
  };
}
