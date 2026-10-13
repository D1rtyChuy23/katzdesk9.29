import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { importEquipmentCodes, type CodesPreview } from "@/lib/ops/equipment-codes-api";
import { WILL_WRITE, type CodePlanStatus } from "@/lib/ops/equipment-codes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const LABEL: Record<CodePlanStatus, { text: string; variant: "success" | "outline" | "warn" | "danger" }> = {
  new: { text: "New model", variant: "success" },
  "new-mpn": { text: "New model + MPN", variant: "success" },
  exists: { text: "Already there", variant: "outline" },
  "set-mpn": { text: "Set MPN", variant: "success" },
  same: { text: "Same MPN", variant: "outline" },
  "needs-mpn": { text: "Needs MPN", variant: "warn" },
  conflict: { text: "Conflict", variant: "danger" },
  invalid: { text: "Incomplete", variant: "danger" },
};

/**
 * Add equipment item codes to The Library under their manufacturer and model. The file lists Manufacturer, Model
 * and, when it is known, the MPN. Nothing is saved until Save; no spec sheet or manual is attached by this.
 */
export function EquipmentCodesImport({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const close = () => {
    onOpenChange(false);
    setPreview(null);
    setFile(null);
  };
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<CodesPreview | null>(null);
  const [only, setOnly] = useState<CodePlanStatus | "all">("all");

  const read = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return { f, base64, p: await importEquipmentCodes({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, base64, p }) => {
      setFile({ name: f.name, base64 });
      setPreview(p);
      setOnly("all");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const writes = preview ? WILL_WRITE.reduce((n, s) => n + preview.counts[s], 0) : 0;
  const save = useMutation({
    mutationFn: () => importEquipmentCodes({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      toast.success(`${r.added} model${r.added === 1 ? "" : "s"} added, ${r.mpnSet} MPN${r.mpnSet === 1 ? "" : "s"} recorded`);
      close();
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const shown = (preview?.lines ?? []).filter((l) => only === "all" || l.status === only);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
        <DialogContent className="sm:max-w-4xl" data-testid="codes-import">
          <DialogTitle>Equipment Codes</DialogTitle>
          <p className="text-sm text-muted-foreground">
            A CSV or Excel worklist with <span className="font-medium">Manufacturer</span>, <span className="font-medium">Model</span> and the{" "}
            <span className="font-medium">MPN</span> once it is confirmed (an item code column is welcome). Each model is added under its
            manufacturer. An MPN is recorded only when the row has one, and nothing is attached: official spec sheets and manuals are matched to the
            MPN afterwards, on the model itself.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={read.isPending} onClick={() => fileRef.current?.click()}>
              <FileUp className="size-4" />
              {read.isPending ? "Reading…" : preview ? "Pick Another File" : "Pick A File"}
            </Button>
            {file ? <span className="text-xs text-muted-foreground">{file.name}</span> : null}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="codes-import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) read.mutate(f);
              }}
            />
          </div>
          {preview ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm" data-testid="codes-import-counts">
                {(Object.keys(LABEL) as CodePlanStatus[])
                  .filter((s) => preview.counts[s])
                  .map((s) => (
                    <button key={s} type="button" onClick={() => setOnly(only === s ? "all" : s)} aria-pressed={only === s}>
                      <Badge variant={LABEL[s].variant} className={only === s ? "ring-2 ring-ring" : ""}>
                        {LABEL[s].text} {preview.counts[s]}
                      </Badge>
                    </button>
                  ))}
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm" data-testid="codes-import-lines">
                  <thead className="sticky top-0 bg-card text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Item code</th>
                      <th className="px-3 py-2 font-medium">Library model</th>
                      <th className="px-3 py-2 font-medium">MPN</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 300).map((l) => (
                      <tr key={l.line} className="border-t border-border align-top">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{l.itemCode || "—"}</td>
                        <td className="px-3 py-1.5 font-medium">{l.title || `${l.manufacturer} ${l.model}`.trim() || "—"}</td>
                        <td className="px-3 py-1.5">{l.mpn ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5 text-xs">
                          <Badge size="tight" variant={LABEL[l.status].variant} className="mr-1">
                            {LABEL[l.status].text}
                          </Badge>
                          {l.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {shown.length > 300 ? <p className="text-xs text-muted-foreground">Showing the first 300 of {shown.length}. Everything in the file is saved.</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={!writes || save.isPending} onClick={() => save.mutate()} data-testid="codes-import-save">
                  {save.isPending ? "Saving…" : `Save ${writes} Model${writes === 1 ? "" : "s"}`}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
