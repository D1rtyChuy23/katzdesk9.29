import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applySerialPull, type SerialPullResult } from "@/lib/ops/serial-pull";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function SerialNoticeBanner({ notice }: { notice?: string | null }) {
  if (!notice?.trim()) return null;
  const miss = /not found/i.test(notice);
  const warn = /already assigned/i.test(notice);
  return (
    <div
      className={`border-b px-5 py-3 text-sm ${
        miss
          ? "border-warning/30 bg-warning/10"
          : warn
            ? "border-warning/30 bg-warning/10"
            : "border-primary/20 bg-primary/5"
      }`}
    >
      <p className="font-medium">{notice}</p>
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
}: {
  label: string;
  value: string;
  onValue: (serial: string) => void;
  installId?: number;
  jobId?: number;
  machineIndex?: number;
  onPulled?: (result: SerialPullResult) => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(value);
  const [pending, setPending] = useState<SerialPullResult | null>(null);
  const looked = useRef("");
  useEffect(() => {
    setText(value);
  }, [value]);

  const pull = useMutation({
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
      if (result.serial && result.serial !== text) setText(result.serial);
      onValue(result.serial);
      onPulled?.(result);
      if (result.pulled) toast.success(result.notice);
      else toast.message(result.notice);
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
    onValue(next);
    if (!next) {
      looked.current = "";
      return;
    }
    if (!installId && !jobId) return;
    const key = next.replace(/[#\s]/g, "").toLowerCase();
    if (!confirmReuse && key === looked.current) return;
    pull.mutate({ serial: next, confirmReuse });
  }

  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        value={text}
        autoComplete="off"
        placeholder="Type the serial"
        onChange={(e) => {
          setText(e.target.value);
          onValue(e.target.value);
        }}
        onBlur={() => {
          if (text.trim()) commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          }
        }}
      />
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
