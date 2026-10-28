import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RenameConfirm } from "@/lib/ops/customer-rename";

export function RenameDialog({
  open,
  title,
  noun,
  current,
  pending,
  onClose,
  onSave,
  check,
}: {
  open: boolean;
  title: string;
  noun: string;
  current: string;
  pending?: boolean;
  onClose: () => void;
  /** `confirmed`: the token of the merge question the person said yes to. */
  onSave: (next: string, confirmed?: string) => void;
  /**
   * Asked before saving (customers): a merge question to show first, or null to save straight away. Nothing merges
   * without a yes here.
   */
  check?: (next: string) => Promise<RenameConfirm | null>;
}) {
  const [name, setName] = useState(current);
  const [checking, setChecking] = useState(false);
  const [asking, setAsking] = useState<{ next: string; confirm: RenameConfirm } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  // Bumped when the window opens, closes, changes account or is cancelled: an answer to an older check is dropped, so
  // a check never saves after Cancel or lands on another account's window.
  const round = useRef(0);
  useEffect(() => {
    round.current += 1;
    if (open) {
      setName(current);
      setAsking(null);
      setCheckError(null);
      setChecking(false);
    }
  }, [open, current]);

  function close() {
    round.current += 1;
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === current || checking) return;
    setCheckError(null);
    if (check) {
      const mine = ++round.current;
      setChecking(true);
      let confirm: RenameConfirm | null;
      try {
        confirm = await check(next);
      } catch (err) {
        if (mine === round.current) {
          setCheckError(err instanceof Error ? err.message : "Could not check the name.");
          setChecking(false);
        }
        return;
      }
      if (mine !== round.current) return;
      setChecking(false);
      if (confirm) {
        setAsking({ next, confirm });
        return;
      }
    }
    onSave(next);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md" data-testid="rename-dialog">
        <DialogTitle className="pr-6">{asking ? asking.confirm.title : title}</DialogTitle>
        {asking ? (
          <div className="mt-3 space-y-4" data-testid="rename-merge-confirm">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {asking.confirm.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAsking(null)} disabled={pending}>
                Back
              </Button>
              <Button type="button" onClick={() => onSave(asking.next, asking.confirm.token)} disabled={pending} data-testid="rename-merge-yes">
                {pending ? "Merging…" : asking.confirm.confirmLabel}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Every ticket, install, recipe, and record using this {noun} will move with the new name.
            </p>
            <form className="mt-4 space-y-3" onSubmit={submit}>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setCheckError(null);
                }}
                aria-label={`New ${noun} name`}
                disabled={checking}
                autoFocus
              />
              {checkError ? (
                <p className="text-sm text-destructive" data-testid="rename-check-error">
                  {checkError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || checking || !name.trim() || name.trim() === current}>
                  {checking ? "Checking…" : "Save name"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
