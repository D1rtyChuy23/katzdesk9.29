import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applySerialPull, type SerialPullResult } from "@/lib/ops/serial-pull";
import { parseAccountSerialNotice } from "@/lib/ops/install-form";
import { sameWarehouseModel } from "@/lib/ops/warehouse-serial";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function SerialNoticeBanner({
  notice,
  onAttach,
}: {
  notice?: string | null;
  /** When the serial is already on the account, add that unit to this install instead of only warning. */
  onAttach?: (unit: { serial: string; model: string }) => void;
}) {
  if (!notice?.trim()) return null;
  const existing = parseAccountSerialNotice(notice);
  const miss = /not found/i.test(notice);
  const warn = /already assigned/i.test(notice) || !!existing;
  return (
    <div
      className={`border-b px-5 py-3 text-sm ${
        miss
          ? "border-warning/30 bg-warning/10"
          : warn
            ? "border-warning/30 bg-warning/10"
            : "border-primary/20 bg-primary/5"
      }`}
      data-testid="serial-notice"
    >
      <p className="font-medium">{notice}</p>
      {existing && onAttach ? (
        <Button type="button" size="sm" variant="outline" className="mt-2" data-testid="attach-existing-unit" onClick={() => onAttach(existing)}>
          Attach existing unit to this install
        </Button>
      ) : null}
    </div>
  );
}

export function SerialPullField({
  label,
  value,
  onValue,
  installId,
  jobId,
  machineIndex,
  onPulled,
  onUseUnit,
  onCleared,
  model,
  compact = false,
}: {
  /** On a one-line machine row: the small caps label the other fields on that row use. */
  compact?: boolean;
  label: string;
  value: string;
  onValue: (serial: string) => void;
  installId?: number;
  jobId?: number;
  machineIndex?: number;
  onPulled?: (result: SerialPullResult) => void;
  /** Replace this row with the account unit that already owns the serial. */
  onUseUnit?: (unit: { model: string; serial: string }) => void;
  /** A serial that was on the row was cleared. Save it now: the next lookup checks the server's list. */
  onCleared?: () => void;
  model?: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(value);
  const [pending, setPending] = useState<SerialPullResult | null>(null);
  const [offer, setOffer] = useState<{ model: string; serial: string } | null>(null);
  const looked = useRef("");
  /** The row's serial before this edit: typing reaches the row right away, so `value` follows the text. */
  const saved = useRef(value);
  useEffect(() => {
    setText(value);
  }, [value]);

  // Behind the install window's saves: a serial just cleared on another row is saved before this lookup asks the server.
  const pull = useMutation({
    scope: installId ? { id: `install-sheet-${installId}` } : undefined,
    mutationFn: (opts: { serial: string; confirmReuse?: boolean }) =>
      applySerialPull({
        data: {
          serial: opts.serial,
          installId,
          jobId,
          machineIndex: machineIndex ?? null,
          confirmReuse: opts.confirmReuse,
        },
      }),
    onSuccess: (result) => {
      if (result.needsConfirm) {
        setPending(result);
        return;
      }
      setPending(null);
      looked.current = result.serial.trim().replace(/[#\s]/g, "").toLowerCase();
      if (result.duplicateOnInstall) {
        // The row goes back to its serial, and typing the same one again asks the server again.
        looked.current = "";
        setText(saved.current);
        onValue(saved.current);
        setOffer(null);
        toast.message(result.notice);
        return;
      }
      if (result.serial && result.serial !== text) setText(result.serial);
      saved.current = result.serial;
      onValue(result.serial);
      onPulled?.(result);
      if (result.alreadyHere && result.model && model && !sameWarehouseModel(model, result.model)) {
        setOffer({ model: result.model, serial: result.serial });
      } else setOffer(null);
      if (result.pulled) toast.success(result.notice);
      else if (!result.alreadyHere) toast.message(result.notice);
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check warehouse"),
  });

  function commit(raw: string, confirmReuse = false) {
    const next = raw.trim();
    if (!next) {
      const had = saved.current.trim();
      looked.current = "";
      saved.current = "";
      setOffer(null);
      onValue("");
      if (had) onCleared?.();
      return;
    }
    if (!installId && !jobId) {
      onValue(next);
      return;
    }
    const key = next.replace(/[#\s]/g, "").toLowerCase();
    if (!confirmReuse && key === looked.current) return;
    pull.mutate({ serial: next, confirmReuse });
  }

  return (
    <div className={compact ? "min-w-0" : undefined}>
      {compact ? (
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      ) : (
        <Label>{label}</Label>
      )}
      <Input
        className="mt-1"
        aria-label={label}
        value={text}
        autoComplete="off"
        placeholder="Type the serial"
        onFocus={() => {
          saved.current = value;
        }}
        onChange={(e) => {
          // The row holds what is typed, so closing the window (Escape too) saves it. The lookup waits for blur or Enter.
          setText(e.target.value);
          onValue(e.target.value);
        }}
        onBlur={() => {
          // A cleared serial is committed too, or the old one would come back on the next save.
          if (text.trim() || saved.current.trim()) commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          }
        }}
      />
      {offer && onUseUnit ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          data-testid="use-account-unit"
          onClick={() => {
            onUseUnit(offer);
            setOffer(null);
          }}
        >
          Use {offer.model} · SN {offer.serial}
        </Button>
      ) : null}
      {pull.isPending ? (
        <p className="mt-1 text-xs text-muted-foreground">Checking warehouse…</p>
      ) : null}
      <Dialog open={!!pending?.needsConfirm} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogTitle>Serial Already Assigned</DialogTitle>
          <DialogDescription>
            {pending?.notice} Reuse it on this {installId ? "install" : "ticket"}, or cancel and leave it where it is.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pending) commit(pending.serial, true);
              }}
            >
              Reuse serial
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
