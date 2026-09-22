import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function RenameDialog({
  open,
  title,
  noun,
  current,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  noun: string;
  current: string;
  pending?: boolean;
  onClose: () => void;
  onSave: (next: string) => void;
}) {
  const [name, setName] = useState(current);
  useEffect(() => {
    if (open) setName(current);
  }, [open, current]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === current) return;
    onSave(next);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Every ticket, install, recipe, and record using this {noun} will move with the new name.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`New ${noun} name`}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim() || name.trim() === current}>
              Save name
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
