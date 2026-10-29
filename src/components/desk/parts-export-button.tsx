import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { todayChicago } from "@/lib/ops/clock";
import { partsExportFileName, partsExportHref } from "@/lib/ops/parts-export";
import { downloadBlob } from "./download-csv";

/**
 * Parts → Export CSV, Admin only (Grok's request through Chuy, 2026-10-29). The whole list, the hidden parts too; with
 * Filtered only, just the class and search the list has (the hidden parts in it too). It only reads: the server checks
 * the Admin again and streams the file.
 */
export function PartsExportButton({ itemClass, q }: { itemClass: string; q: string }) {
  const [filtered, setFiltered] = useState(false);
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    try {
      const res = await fetch(partsExportHref({ filtered, itemClass, q }), { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) {
        const said = await res
          .json()
          .then((j: { error?: unknown }) => (typeof j?.error === "string" ? j.error : null))
          .catch(() => null);
        throw new Error(said ?? `Could not export the parts (${res.status}).`);
      }
      const blob = await res.blob().catch(() => {
        throw new Error("The parts file stopped partway. Try again.");
      });
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? partsExportFileName(todayChicago());
      downloadBlob(name, blob);
      const count = res.headers.get("X-Parts-Count");
      const n = Number(count);
      toast.success(count && Number.isFinite(n) ? `${name}: ${n.toLocaleString()} part${n === 1 ? "" : "s"}` : name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export the parts.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3" data-testid="parts-export">
      <label className="flex items-center gap-2 text-sm" title="Only the parts in the class and search below, the hidden ones in them too">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={filtered}
          onChange={(e) => setFiltered(e.target.checked)}
          data-testid="parts-export-filtered"
        />
        Filtered only
      </label>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void exportCsv()} data-testid="parts-export-csv">
        <FileDown className="size-4" />
        {busy ? "Exporting…" : "Export CSV"}
      </Button>
    </div>
  );
}
