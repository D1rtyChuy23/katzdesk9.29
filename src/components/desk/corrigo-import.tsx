import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyCorrigoImport, previewCorrigoImport } from "@/lib/ops/corrigo-import";
import type { CorrigoApplyResult } from "@/lib/ops/corrigo-import";
import {
  chunkByBytes,
  COL_LABEL,
  isWalkIn,
  mergeCorrigoPreviews,
  normalizeCustomerKey,
  settleInstallRows,
  type CorrigoPreview,
  type CorrigoPreviewRow,
} from "@/lib/ops/corrigo";
import { readCorrigoFile } from "@/lib/ops/corrigo-file";
import { stripServiceChannelId } from "@/lib/ops/billing-rules";
import { nameKey } from "@/lib/ops/wo-history";
import { woBoardName } from "@/lib/ops/wo-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboField } from "@/components/ui/combo-field";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { OpenLink } from "@/components/desk/open-link";
import { useDirectory } from "@/components/desk/directory-fields";
import { ActionButton } from "@/components/desk/desk-charts";

export type CorrigoReviewItem = CorrigoApplyResult["review"][number];

/** "2 created on Installs" or "3 created (2 on Tickets, 1 on PMs)". */
function createdText(res: CorrigoApplyResult): string {
  const byBoard = new Map<string, number>();
  for (const item of res.review) {
    if (!item.created) continue;
    const board = woBoardName(item.entityType);
    byBoard.set(board, (byBoard.get(board) ?? 0) + 1);
  }
  const boards = [...byBoard];
  if (boards.length === 1) return `${res.created} created on ${boards[0][0]}`;
  if (!boards.length) return `${res.created} created`;
  return `${res.created} created (${boards.map(([board, n]) => `${n} on ${board}`).join(", ")})`;
}

export function CorrigoImportButton({
  onImported,
}: {
  onImported: (review: CorrigoReviewItem[]) => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CorrigoPreview | null>(null);

  const load = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await readCorrigoFile(file);
      const parts = [];
      for (const records of chunkByBytes(parsed.records)) {
        parts.push(await previewCorrigoImport({ data: { records } }));
      }
      const merged = mergeCorrigoPreviews(parts, parsed);
      // In file order across every chunk: a later chunk's row for an install sees the WO an earlier row puts on it.
      return { ...merged, rows: settleInstallRows(merged.rows) };
    },
    onSuccess: (data, file) => {
      setFileName(file.name);
      setPreview(data);
      setOpen(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the report"),
  });

  const apply = useMutation({
    mutationFn: async (rows: CorrigoPreview["rows"]) => {
      const out: CorrigoApplyResult = { updated: 0, created: 0, review: [], refused: [] };
      const seen = new Set<string>();
      for (const chunk of chunkByBytes(rows.filter((r) => r.action !== "skip"))) {
        let res: CorrigoApplyResult;
        try {
          res = await applyCorrigoImport({ data: { rows: chunk } });
        } catch (e) {
          const why = e instanceof Error ? e.message : "Could not import";
          if (!out.updated && !out.created) throw e;
          // Tickets the earlier chunks created still go to For Review. Rows the failed chunk wrote first aren't counted.
          onImported(out.review);
          throw new Error(
            `Stopped after at least ${out.updated + out.created} rows were saved: ${why} Importing the same file again is safe — rows match by WO.`,
          );
        }
        out.updated += res.updated;
        out.created += res.created;
        out.refused!.push(...(res.refused ?? []));
        // Each chunk re-checks held merges, so the same ticket can come back twice.
        for (const item of res.review) {
          const key = `${item.entityType}-${item.id}`;
          if (!seen.has(key)) out.review.push(item);
          seen.add(key);
        }
      }
      return out;
    },
    onSuccess: (res) => {
      const notMerged = res.review.filter((item) => item.reason === "merge").length;
      toast.success(
        `Corrigo import saved · ${res.updated} updated · ${createdText(res)}${notMerged ? ` · ${notMerged} not merged` : ""}`,
      );
      if (res.refused?.length) {
        // Rows with no account to write them with: nothing was written for them.
        toast.warning(
          `${res.refused.length} row${res.refused.length === 1 ? "" : "s"} not written (no account): ${res.refused
            .slice(0, 8)
            .map((r) => r.wo)
            .join(", ")}${res.refused.length > 8 ? ", …" : ""}. Import the file again after picking or restoring the accounts.`,
          { duration: 15000 },
        );
      }
      setOpen(false);
      setPreview(null);
      onImported(res.review);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not import"),
    // Earlier chunks may be saved even when a later one fails.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["charges"] });
      void qc.invalidateQueries({ queryKey: ["invoice"] });
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
    },
  });

  function cancel() {
    setOpen(false);
    setPreview(null);
    setFileName("");
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) load.mutate(file);
        }}
      />
      <ActionButton icon={Upload} menuLabel="Corrigo Report" busy={load.isPending} onClick={() => inputRef.current?.click()} data-testid="corrigo-import-open">
        Import Corrigo Report
      </ActionButton>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cancel())}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogTitle>Corrigo Import</DialogTitle>
          <DialogDescription>
            {fileName ? `${fileName} · ` : ""}
            Corrigo is the source of truth for service. Confirm before anything is written. Accounts are matched by their exact
            name only and the import never adds one; Walk-In takes its Service Location&apos;s account. Unchecked rows are skipped.
          </DialogDescription>
          {preview ? (
            <PreviewBody
              preview={preview}
              pending={apply.isPending}
              onCancel={cancel}
              onConfirm={(rows) => apply.mutate(rows)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function rowKey(row: CorrigoPreviewRow) {
  return row.matchKey || row.canonicalWo || row.wo;
}

type RowDraft = {
  selected: boolean;
  customer: string;
  /** The person picked the customer; until then it follows the install choice. */
  customerEdited: boolean;
  /**
   * Install rows with a picker: the install the person chose (null = a new install). Not set: the preselection, which
   * can change as earlier rows change (a later row follows the first row's new install).
   */
  installChoice?: number | null;
};

/** A row with no account to write with starts unticked: it needs one picked (10/28). */
function draftFor(row: CorrigoPreviewRow): RowDraft {
  const applicable = row.action === "update" || row.action === "create";
  return {
    selected: applicable && !row.needsReview,
    customer: row.customer ?? "",
    customerEdited: false,
  };
}

/** The customer a row imports with: the person's pick, else the one that goes with its install choice. */
function customerOf(row: CorrigoPreviewRow, d: RowDraft): string {
  return d.customerEdited ? d.customer : row.customer ?? "";
}

/** A ticked row with no account (blank or Walk-In) can't be written. */
const lacksAccount = (name: string) => !name.trim() || isWalkIn(name);

/** Why a row is listed among the warnings at the top, or null. */
function statusWarning(r: CorrigoPreviewRow, hasStatusColumn: boolean): string | null {
  if (r.action === "skip") return null;
  if (r.statusUnmapped) return r.statusUnmapped;
  return hasStatusColumn && !r.statusRaw?.trim() && !r.completedAt ? "(blank)" : null;
}

function PreviewBody({
  preview,
  pending,
  onCancel,
  onConfirm,
}: {
  preview: CorrigoPreview;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (rows: CorrigoPreview["rows"]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => {
    const next: Record<string, RowDraft> = {};
    for (const row of preview.rows) next[rowKey(row)] = draftFor(row);
    return next;
  });
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next: Record<string, RowDraft> = {};
    for (const row of preview.rows) next[rowKey(row)] = draftFor(row);
    setDrafts(next);
  }, [preview]);

  // The rows as the import will write them with each install row's choice, in file order (the import repeats this).
  const rows = useMemo(
    () =>
      settleInstallRows(
        preview.rows,
        // null is a choice too (a new install); a row nobody picked for (undefined) takes the preselection.
        (r) => drafts[rowKey(r)]?.installChoice,
        (r) => drafts[rowKey(r)]?.selected ?? true,
        // A first row's customer as the person set it names the new install its followers go on.
        (r) => {
          const d = drafts[rowKey(r)];
          return d && d.customerEdited ? customerOf(r, d) : undefined;
        },
      ),
    [preview.rows, drafts],
  );
  const applicable = rows.filter((r) => r.action === "update" || r.action === "create");
  const selectedUpdates = applicable.filter(
    (r) => drafts[rowKey(r)]?.selected && r.action === "update",
  ).length;
  const selectedCreates = applicable.filter(
    (r) => drafts[rowKey(r)]?.selected && r.action === "create",
  ).length;
  const unchecked = applicable.filter((r) => !drafts[rowKey(r)]?.selected).length;
  const selectedCount = selectedUpdates + selectedCreates;
  const allSelected = applicable.length > 0 && selectedCount === applicable.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // Ticked rows with no account to write with: Confirm waits until each has one picked, or is unticked.
  const walkInBlocked = applicable.filter((r) => {
    const d = drafts[rowKey(r)];
    return !!d?.selected && lacksAccount(customerOf(r, d));
  });
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const hasStatusColumn = !preview.missing.includes("status");
  const statusCounts = new Map<string, number>();
  for (const r of rows) {
    const w = statusWarning(r, hasStatusColumn);
    if (w) statusCounts.set(w, (statusCounts.get(w) ?? 0) + 1);
  }
  const reviewRows = applicable.filter((r) => r.needsReview);
  // Rows still without an account, as the person has them now (a pick clears one).
  const stillNeed = applicable.filter((r) => lacksAccount(customerOf(r, drafts[rowKey(r)] ?? draftFor(r))));
  const fromLocation = applicable.filter((r) => r.account?.status === "location");
  const noReceived = applicable.filter((r) => r.action === "create" && !r.createdAt);
  const collisions = rows.filter((r) => r.action !== "skip" && (r.conflictIds?.length || r.wrapRepeat || r.shared));
  const rowWarned = (r: CorrigoPreviewRow) =>
    !!statusWarning(r, hasStatusColumn) || !!r.needsReview || !!r.conflictIds?.length || r.wrapRepeat || !!r.completedNote || !!r.poNote || (r.action === "create" && !r.createdAt);
  const shownRows = onlyWarnings ? rows.filter(rowWarned) : rows;

  function patch(key: string, next: Partial<RowDraft>) {
    setDrafts((cur) => {
      const prev = cur[key] ?? { selected: false, customer: "", customerEdited: false };
      return { ...cur, [key]: { ...prev, ...next } };
    });
  }

  function setAll(selected: boolean) {
    setDrafts((cur) => {
      const next = { ...cur };
      for (const row of applicable) {
        const key = rowKey(row);
        next[key] = { ...(next[key] ?? draftFor(row)), selected };
      }
      return next;
    });
  }

  function confirm() {
    if (walkInBlocked.length || selectedCount === 0) return;
    const out = rows.map((row) => {
      const d = drafts[rowKey(row)];
      const applicableRow = row.action === "update" || row.action === "create";
      // The picker's options stay here; the import re-reads the chosen install itself.
      const lean = { ...row, installOptions: null, installState: null, account: null };
      if (!applicableRow || !d?.selected) return { ...lean, action: "skip" as const };
      const customer = customerOf(row, d).trim() || row.customer;
      return { ...lean, customer };
    });
    onConfirm(out);
  }

  return (
    <div className="mt-4">
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{selectedUpdates}</span> selected to update
        </li>
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{selectedCreates}</span> selected to create
        </li>
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{unchecked}</span> unchecked (will skip)
        </li>
        <li
          className={`rounded-lg border px-3 py-2 ${stillNeed.length ? "border-warning/40 bg-warning/10" : "border-border bg-muted/40"}`}
          data-testid="corrigo-need-account"
        >
          <span className="font-medium">{stillNeed.length}</span> need{stillNeed.length === 1 ? "s" : ""} an account picked
        </li>
      </ul>

      <ul className="mt-3 space-y-1.5 text-xs" data-testid="corrigo-warnings">
        {statusCounts.size ? (
          <li className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2" data-testid="corrigo-status-warnings">
            <span className="font-medium">Statuses KatzDesk doesn&apos;t map: </span>
            {[...statusCounts].map(([st, n]) => `${st} (${n})`).join(", ")}. Those tickets keep their KatzDesk status; new ones open as
            Open, Pending Scheduling or Not Ready, by board.
          </li>
        ) : null}
        {reviewRows.length ? (
          <li className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2" data-testid="corrigo-review-accounts">
            <span className="font-medium">Needs review: </span>
            {reviewRows.length === 1
              ? "1 row has no account by that exact name, or is Walk-In with no Service Location that is an account. It starts unticked; pick an account to include it."
              : `${reviewRows.length} rows have no account by that exact name, or are Walk-In with no Service Location that is an account. They start unticked; pick an account to include one.`}{" "}
            The import never adds accounts.
          </li>
        ) : null}
        {fromLocation.length ? (
          <li className="rounded-lg border border-border bg-muted/40 px-3 py-2" data-testid="corrigo-from-location">
            {fromLocation.length === 1
              ? "1 Walk-In row takes its account from the Service Location Name."
              : `${fromLocation.length} Walk-In rows take their account from the Service Location Name.`}
          </li>
        ) : null}
        {noReceived.length ? (
          <li className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2" data-testid="corrigo-no-received">
            {noReceived.length === 1
              ? "1 new ticket gets no received date: the file has no created date for it."
              : `${noReceived.length} new tickets get no received date: the file has no created date for them.`}{" "}
            Fill it on the ticket, or export the report with its Created column.
          </li>
        ) : null}
        {collisions.length ? (
          <li className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2" data-testid="corrigo-collisions">
            <span className="font-medium">WO collisions ({collisions.length}): </span>
            {collisions.slice(0, 12).map((r) => (
              <span key={rowKey(r)} className="mt-0.5 block">
                {r.canonicalWo}: {r.action === "update" ? `goes on ${r.boardLabel ?? "ticket"} #${r.jobId}` : "opens a new ticket"}
                {r.conflictIds?.length ? ` · also on ${r.conflictIds.map((c) => `${c.board} #${c.id}`).join(", ")} (flagged to merge)` : ""}
                {r.shared ? ` · ${r.shared}` : r.wrapRepeat ? " · the number was used again after WO-9999" : ""}
              </span>
            ))}
            {collisions.length > 12 ? <span className="mt-0.5 block">and {collisions.length - 12} more (Warnings only lists them).</span> : null}
          </li>
        ) : null}
        {preview.skipped ? (
          <li className="px-1 text-muted-foreground">
            {preview.skipped} row{preview.skipped === 1 ? "" : "s"} without an ST# number.
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground" data-testid="corrigo-columns">
        Read from file:{" "}
        {(Object.keys(COL_LABEL) as (keyof typeof COL_LABEL)[])
          .filter((c) => preview.columns[c] || ["wo", "status", "completedAt", "customer"].includes(c))
          .map((c) => `${COL_LABEL[c]} ← ${preview.columns[c] ?? "not found"}`)
          .join(" · ")}
      </p>
      {preview.missing.includes("status") ? (
        <p className="mt-2 text-xs text-warning" data-testid="corrigo-no-status">
          No status column found. Existing tickets keep their status; new tickets open as Open, Pending
          Scheduling or Not Ready, by board.
        </p>
      ) : null}
      {preview.missing.includes("completedAt") ? (
        <p className="mt-2 text-xs text-warning" data-testid="corrigo-no-completed">
          No completed-date column found. Completed dates on existing tickets will not change.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setAll(true)}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAll(false)}>
          Deselect all
        </Button>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={onlyWarnings}
            onChange={(e) => setOnlyWarnings(e.target.checked)}
            data-testid="corrigo-only-warnings"
          />
          Warnings only
        </label>
        <p className="text-xs text-muted-foreground">Uncheck any ticket you do not want to change. A row with no account needs one picked.</p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="sticky top-0 bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  disabled={!applicable.length}
                  aria-label="Select all"
                  onChange={(e) => setAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">ST#</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tech</th>
              <th className="px-3 py-2">Completed</th>
              <th className="px-3 py-2">Also changes</th>
            </tr>
          </thead>
          <tbody>
            {shownRows.map((r) => {
              const key = rowKey(r);
              const d = drafts[key] ?? draftFor(r);
              const customer = customerOf(r, d);
              const locked = r.action === "skip";
              const walkIn = r.fileWalkIn;
              const needsCustomer = !locked && lacksAccount(customer);
              return (
                <tr
                  key={key}
                  className={`border-t border-border ${needsCustomer ? "bg-warning/10" : ""} ${locked ? "opacity-70" : ""}`}
                  data-testid="corrigo-row"
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={!!d.selected && !locked}
                      disabled={locked || pending}
                      aria-label={`Import ${r.canonicalWo || r.wo}`}
                      onChange={(e) => patch(key, { selected: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top font-medium">
                    <span className="whitespace-nowrap">{r.canonicalWo || r.wo}</span>
                    <span className="mt-0.5 block text-[11px] font-normal tracking-wide text-muted-foreground uppercase">
                      {r.action}
                      {r.boardLabel ? ` · ${r.boardLabel}` : ""}
                    </span>
                    {r.matchNote ? (
                      <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                        {r.matchNote}
                      </span>
                    ) : null}
                    {r.wrapRepeat ? (
                      <span className="mt-0.5 block text-[11px] font-normal tracking-wide text-warning uppercase">
                        {r.shared ? "Number on another ticket too" : "Repeated after 9999"}
                      </span>
                    ) : null}
                    {r.conflictIds?.length ? (
                      <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                        also on {r.conflictIds.map((c) => `${c.board} #${c.id}`).join(", ")} (conflict
                        — will flag)
                      </span>
                    ) : null}
                    {walkIn ? (
                      <span className="mt-0.5 block text-[11px] font-normal tracking-wide text-warning uppercase">
                        Walk-In
                      </span>
                    ) : null}
                  </td>
                  <td className="min-w-[13rem] px-3 py-2 align-top">
                    {locked ? (
                      <span>{customer || r.customer || "—"}</span>
                    ) : (
                      <ImportCustomerPicker
                        value={customer}
                        needsCustomer={needsCustomer}
                        existingCustomer={r.existingCustomer}
                        note={d.customerEdited ? null : r.account?.note ?? null}
                        disabled={pending}
                        onChange={(next) =>
                          // Picking an account ticks the row; clearing it unticks it.
                          patch(key, { customer: next, customerEdited: true, selected: !lacksAccount(next) })
                        }
                      />
                    )}
                    {!locked && r.installOptions?.length ? (
                      <ImportInstallPicker
                        row={r}
                        disabled={pending}
                        onChange={(installChoice) => patch(key, { installChoice })}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.oldStatus ? `${r.oldStatus} → ${r.newStatus}` : r.newStatus}
                    {r.statusNote ? (
                      <span
                        className={`mt-0.5 block text-[11px] ${statusWarning(r, hasStatusColumn) ? "text-warning" : "text-muted-foreground"}`}
                        data-testid="corrigo-status-note"
                      >
                        {r.statusNote}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">{r.technician || "—"}</td>
                  <td className="px-3 py-2 align-top">
                    <span className="whitespace-nowrap">
                      {r.completedKept
                        ? r.oldCompletedAt || "—"
                        : r.completedCleared
                          ? `${r.oldCompletedAt} → (cleared, reopened)`
                          : r.oldCompletedAt && r.completedAt && r.oldCompletedAt !== r.completedAt
                            ? `${r.oldCompletedAt} → ${r.completedAt}`
                            : r.completedAt || r.oldCompletedAt || "—"}
                    </span>
                    {r.completedNote ? (
                      <span className="mt-0.5 block max-w-[14rem] text-[11px] text-warning">{r.completedNote}</span>
                    ) : null}
                  </td>
                  <td className="min-w-[14rem] max-w-[18rem] px-3 py-2 align-top text-[11px]" data-testid="corrigo-changes">
                    <RowChanges r={r} />
                  </td>
                </tr>
              );
            })}
            {preview.rows.length === 0 || (onlyWarnings && !shownRows.length) ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                  {preview.rows.length ? "No warnings." : "Nothing to import."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {walkInBlocked.length ? (
          <p className="mr-auto max-w-md text-xs text-warning" data-testid="corrigo-blocked">
            {walkInBlocked.length} ticked row{walkInBlocked.length === 1 ? " has" : "s have"} no account. Pick one for each, or untick{" "}
            {walkInBlocked.length === 1 ? "it" : "them"}.
          </p>
        ) : null}
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={pending || selectedCount === 0 || walkInBlocked.length > 0}
          onClick={confirm}
        >
          {pending ? "Saving…" : "Confirm import"}
        </Button>
      </div>
    </div>
  );
}

const clip = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** What else a row writes, besides status and dates: shown so nothing changes unseen (10/28). */
function RowChanges({ r }: { r: CorrigoPreviewRow }) {
  if (r.action === "skip") return <span className="text-muted-foreground">—</span>;
  const items: { text: string; warn?: boolean; title?: string }[] = [];
  if (r.poChange) items.push({ text: `P.O. ${r.poChange.from || "none"} → ${r.poChange.to}` });
  else if (r.action === "create" && r.po) items.push({ text: `P.O. ${r.po}` });
  if (r.poNote) items.push({ text: r.poNote, warn: true });
  if (r.issueChange) items.push({ text: `Issue → ${clip(r.issueChange.to)}`, title: `Was: ${r.issueChange.from ?? "blank"}\nNow: ${r.issueChange.to}` });
  if (r.equipmentChange) items.push({ text: `Equipment ${r.equipmentChange.from ? `${clip(r.equipmentChange.from, 30)} ` : ""}→ ${clip(r.equipmentChange.to, 40)}` });
  if (r.action === "update" && r.existingCustomer && r.customer && r.customer !== r.existingCustomer) {
    items.push({ text: `Customer ${r.existingCustomer} → ${r.customer}` });
  }
  if (r.action === "create") {
    items.push(r.createdAt ? { text: `Received ${r.createdAt}` } : { text: "No received date (none in the file)", warn: true });
    if (r.callTypeValue) items.push({ text: `Type ${r.callTypeValue} · ${r.urgency ?? "Normal"}` });
  }
  if (r.typeNote) items.push({ text: r.typeNote, warn: true });
  // The location is saved on every row; it is worth a line where it isn't the row's account (Walk-In, another site).
  if (r.serviceLocation && nameKey(stripServiceChannelId(r.serviceLocation)) !== nameKey(r.customer)) {
    items.push({ text: `Corrigo location ${clip(r.serviceLocation, 40)}`, title: r.serviceLocation });
  }
  if (r.contact) items.push({ text: `Contact ${r.contact}${r.phone ? ` · ${r.phone}` : ""}` });
  if (r.corrigoNet != null) items.push({ text: `Corrigo net $${r.corrigoNet.toFixed(2)}` });
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} title={it.title} className={it.warn ? "text-warning" : "text-muted-foreground"}>
          {it.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Install rows no install's WO matches, for an account with open installs: which install the WO goes on, or a new
 * one. The same list as the customer picker above it. Both names show when the install's differs from Corrigo's.
 */
function ImportInstallPicker({
  row,
  disabled,
  onChange,
}: {
  row: CorrigoPreviewRow;
  disabled?: boolean;
  onChange: (installChoice: number | null) => void;
}) {
  const options = row.installOptions ?? [];
  const items = options.map((o, i) => ({ id: i + 1, name: o.label }));
  const chosen = options.find((o) => o.id === row.installChoice) ?? options.find((o) => o.id == null);
  const named = chosen?.id != null && chosen.customer && normalizeCustomerKey(chosen.customer) !== normalizeCustomerKey(row.fileCustomer);
  return (
    <div className="mt-2 min-w-0" data-testid="corrigo-install-picker">
      <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Install</p>
      <ComboField
        value={chosen?.label ?? ""}
        onChange={(label) => {
          const next = options.find((o) => o.label === label);
          // Clearing the field leaves the choice as it was.
          if (next) onChange(next.id);
        }}
        items={items}
        placeholder="Pick an install…"
        allowCreate={false}
        disabled={disabled}
        noun="install"
        emptyHint="No install matches. Pick one of the list, or Create new install."
      />
      {named ? (
        <span className="mt-1 block text-xs text-muted-foreground" data-testid="corrigo-install-names">
          Corrigo: {row.fileCustomer} · Install: {chosen!.customer}
        </span>
      ) : null}
    </div>
  );
}

function ImportCustomerPicker({
  value,
  needsCustomer,
  existingCustomer,
  note,
  disabled,
  onChange,
}: {
  value: string;
  needsCustomer: boolean;
  existingCustomer: string | null;
  /** How the account was found: from the Service Location Name, the locked name, or why none matched. */
  note: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  // Accounts only: the import never adds one (10/28). Walk-In is never an account.
  const dir = useDirectory("customer");
  const items = useMemo(() => dir.items.filter((i) => !isWalkIn(i.name)), [dir.items]);
  return (
    <div className="min-w-0">
      <ComboField
        value={lacksAccount(value) ? "" : value}
        onChange={onChange}
        items={items}
        placeholder={needsCustomer ? "Pick an account…" : "Search accounts…"}
        allowCreate={false}
        disabled={disabled}
        noun="account"
        emptyHint="No account matches. The import never adds accounts: add it under Customers first."
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {existingCustomer && !isWalkIn(existingCustomer) && existingCustomer !== value ? (
          <span className="text-xs text-muted-foreground">Now: {existingCustomer}</span>
        ) : null}
        {needsCustomer ? <span className="text-xs text-warning">Pick an account</span> : null}
        {note ? (
          <span className={`text-[11px] ${needsCustomer ? "text-warning" : "text-muted-foreground"}`} data-testid="corrigo-account-note">
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CorrigoReviewList({
  items,
  onDismiss,
}: {
  items: CorrigoReviewItem[];
  onDismiss: () => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">For Review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open work from the last Corrigo file, every ticket it created (closed ones too), ST#s that reused a number after WO-9999 or share it with another customer&apos;s ticket, and tickets that could not be merged.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          Clear
        </Button>
      </div>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((item) => (
          <li key={`${item.entityType}-${item.id}`}>
            <OpenLink
              entityType={item.entityType}
              id={item.id}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.customer || "Untitled"}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.wo}
                  {item.entityType && item.entityType !== "service" ? ` · ${woBoardName(item.entityType)}` : ""}
                  {item.created ? " · new" : ""}
                  {item.technician ? ` · ${item.technician}` : ""}
                  {item.reason === "wrap" ? (item.note ? " · number on another ticket too" : " · repeated after 9999") : ""}
                </span>
                {item.reason === "merge" && item.note ? (
                  <span className="mt-0.5 block whitespace-normal text-xs text-muted-foreground">not merged: {item.note}</span>
                ) : null}
                {item.reason !== "merge" && item.note ? (
                  <span className="mt-0.5 block whitespace-normal text-xs text-muted-foreground">{item.note}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.reason === "wrap" && !/open|dispatch|progress|follow/i.test(item.status)
                  ? "Review"
                  : item.status}
              </span>
            </OpenLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
