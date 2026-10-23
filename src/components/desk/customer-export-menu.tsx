import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { exportCustomers } from "@/lib/ops/customer-review-api";
import { ActionButton, ActionMenu } from "./desk-charts";
import { downloadBase64 } from "./export-dialog";

/**
 * Admin-only: Customers → Export. Every account, removed ones too, one row each: KatzDesk ID, NetSuite ID, Account
 * Number, the site address in its parts, billing address, phone, email, rep, when and how it was added, and the Walk-In,
 * Inactive, Removed and Flagged For Review marks. CSV for other programs; Excel keeps IDs and numbers as written.
 */
export function CustomerExportMenu() {
  const run = useMutation({
    mutationFn: (format: "csv" | "xlsx") => exportCustomers({ data: { format } }),
    onSuccess: (file) => {
      downloadBase64(file.filename, file.mime, file.base64);
      toast.success(`Exported ${file.rows.toLocaleString("en-US")} accounts`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not export the customers"),
  });
  const busy = (format: "csv" | "xlsx") => run.isPending && run.variables === format;
  return (
    <ActionMenu label="Export" busyLabel="Exporting…" testId="customers-export">
      <ActionButton icon={FileText} busy={busy("csv")} busyLabel="Exporting…" onClick={() => run.mutate("csv")} data-testid="customers-export-csv">
        Customers CSV
      </ActionButton>
      <ActionButton icon={FileSpreadsheet} busy={busy("xlsx")} busyLabel="Exporting…" onClick={() => run.mutate("xlsx")} data-testid="customers-export-xlsx">
        Customers Excel
      </ActionButton>
    </ActionMenu>
  );
}
