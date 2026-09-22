import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const ROWS: { keys: string; action: string }[] = [
  { keys: "⌘K", action: "Search accounts, serials, and WOs" },
  { keys: "?", action: "Open these shortcuts" },
  { keys: "Esc", action: "Close a sheet or dialog" },
];

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogTitle>Keyboard</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">Works anywhere on the desk except while typing.</p>
        <ul className="mt-4 divide-y divide-border">
          {ROWS.map((r) => (
            <li key={r.keys} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm">{r.action}</span>
              <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs">{r.keys}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
