import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { woBoardName } from "@/lib/ops/wo-search";
import { addDirectoryEntry, updateCustomerAccount } from "@/lib/ops/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboField, type ComboItem } from "@/components/ui/combo-field";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { OpenLink } from "@/components/desk/open-link";
import { useDirectory } from "@/components/desk/directory-fields";
import { RepSelect } from "@/components/desk/rep-select";
import { AkBadge } from "@/components/desk/ak-badge";
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
      const out: CorrigoApplyResult = { updated: 0, created: 0, review: [] };
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
        <DialogContent
          className="max-h-[90vh] max-w-5xl overflow-y-auto"
          onPointerDownOutside={(e) => {
            if (document.querySelector("[data-testid=add-customer-form]")) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (document.querySelector("[data-testid=add-customer-form]")) e.preventDefault();
          }}
        >
          <DialogTitle>Corrigo Import</DialogTitle>
          <DialogDescription>
            {fileName ? `${fileName} · ` : ""}
            Corrigo is the source of truth for service. Confirm before anything is written.
            Notes and sales fields stay as they are. Unchecked rows are skipped.
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
  keepWalkIn: boolean;
  /** Install rows with a picker: the install chosen (null = a new install). */
  installChoice: number | null;
};

function draftFor(row: CorrigoPreviewRow): RowDraft {
  const applicable = row.action === "update" || row.action === "create";
  return {
    selected: applicable,
    customer: row.customer ?? "",
    customerEdited: false,
    keepWalkIn: false,
    installChoice: row.installChoice,
  };
}

/** The customer a row imports with: the person's pick, else the one that goes with its install choice. */
function customerOf(row: CorrigoPreviewRow, d: RowDraft): string {
  return d.customerEdited || d.keepWalkIn ? d.customer : row.customer ?? "";
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
        // null is a choice too (a new install), so only a row with no draft yet takes the preselection.
        (r) => (rowKey(r) in drafts ? drafts[rowKey(r)]!.installChoice : r.installChoice),
        (r) => drafts[rowKey(r)]?.selected ?? true,
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

  const walkInBlocked = applicable.filter((r) => {
    const d = drafts[rowKey(r)];
    if (!d?.selected) return false;
    if (!r.fileWalkIn) return false;
    if (d.keepWalkIn) return false;
    const name = customerOf(r, d).trim();
    return !name || isWalkIn(name);
  });

  function patch(key: string, next: Partial<RowDraft>) {
    setDrafts((cur) => {
      const prev = cur[key] ?? { selected: false, customer: "", customerEdited: false, keepWalkIn: false, installChoice: null };
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
      const lean = { ...row, installOptions: null, installState: null };
      if (!applicableRow || !d?.selected) return { ...lean, action: "skip" as const };
      const customer = d.keepWalkIn ? "Walk-In" : customerOf(row, d).trim() || row.customer;
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
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          {preview.missing.includes("status")
            ? "No status column"
            : preview.unmapped.length
              ? `${preview.unmapped.length} unmapped status${preview.unmapped.length === 1 ? "" : "es"}`
              : "No unmapped statuses"}
        </li>
      </ul>
      {preview.wrapCount ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.wrapCount} ST#{preview.wrapCount === 1 ? "" : "s"} reused a number after WO-9999 or{" "}
          {preview.wrapCount === 1 ? "shares" : "share"} it with another customer&apos;s ticket — those stay on For review so
          nobody merges two different jobs
          {preview.conflictCount
            ? ` · ${preview.conflictCount} already on more than one ticket`
            : ""}
          {preview.skipped
            ? ` · ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} without an ST# number`
            : ""}
          .
        </p>
      ) : preview.conflictCount ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.conflictCount} WO conflict{preview.conflictCount === 1 ? "" : "s"} already on more
          than one ticket — import updates the original and flags the rest to merge
          {preview.skipped
            ? ` · ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} without an ST# number`
            : ""}
          .
        </p>
      ) : preview.skipped ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.skipped} row{preview.skipped === 1 ? "" : "s"} without an ST# number.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground" data-testid="corrigo-columns">
        Read from file:{" "}
        {(Object.keys(COL_LABEL) as (keyof typeof COL_LABEL)[])
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
      {preview.unmapped.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Unmapped: {preview.unmapped.join(", ")}. Existing tickets keep their KatzDesk status;
          new tickets open as Open, Pending Scheduling or Not Ready, by board.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setAll(true)}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAll(false)}>
          Deselect all
        </Button>
        <p className="text-xs text-muted-foreground">
          Uncheck any ticket you do not want to change. Walk-In rows need a real customer, or Keep
          as Walk-In.
        </p>
      </div>

      <div className="mt-3 overflow-visible rounded-xl border border-border">
        <table className="w-full min-w-[52rem] text-left text-sm">
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const key = rowKey(r);
              const d = drafts[key] ?? draftFor(r);
              const customer = customerOf(r, d);
              const locked = r.action === "skip";
              const walkIn = r.fileWalkIn;
              const needsCustomer =
                !locked &&
                d.selected &&
                walkIn &&
                !d.keepWalkIn &&
                (!customer.trim() || isWalkIn(customer));
              return (
                <tr
                  key={key}
                  className={`border-t border-border ${
                    walkIn ? "bg-warning/10" : ""
                  } ${locked ? "opacity-70" : ""}`}
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
                  <td className="min-w-[16rem] px-3 py-2 align-top">
                    {locked ? (
                      <span>{customer || r.customer || "—"}</span>
                    ) : (
                      <ImportCustomerPicker
                        value={d.keepWalkIn ? "Walk-In" : customer}
                        walkIn={walkIn}
                        keepWalkIn={d.keepWalkIn}
                        needsCustomer={needsCustomer}
                        existingCustomer={r.existingCustomer}
                        disabled={pending}
                        onChange={(next) =>
                          patch(key, {
                            customer: next,
                            customerEdited: true,
                            keepWalkIn: isWalkIn(next) ? d.keepWalkIn : false,
                          })
                        }
                        onKeepWalkIn={() => patch(key, { keepWalkIn: true, customer: "Walk-In", customerEdited: true })}
                        onClearKeep={() => patch(key, { keepWalkIn: false, customer: "", customerEdited: true })}
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
                      <span className={`mt-0.5 block text-[11px] ${r.statusUnmapped ? "text-warning" : "text-muted-foreground"}`}>
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
                </tr>
              );
            })}
            {preview.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  Nothing to import.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {walkInBlocked.length ? (
          <p className="mr-auto max-w-md text-xs text-warning">
            {walkInBlocked.length} Walk-In row{walkInBlocked.length === 1 ? "" : "s"} still need a
            KatzDesk customer, or Keep as Walk-In.
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
  walkIn,
  keepWalkIn,
  needsCustomer,
  existingCustomer,
  disabled,
  onChange,
  onKeepWalkIn,
  onClearKeep,
}: {
  value: string;
  walkIn: boolean;
  keepWalkIn: boolean;
  needsCustomer: boolean;
  existingCustomer: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
  onKeepWalkIn: () => void;
  onClearKeep: () => void;
}) {
  const dir = useDirectory("customer");
  const qc = useQueryClient();
  const items = useMemo(
    () => dir.items.filter((i) => !isWalkIn(i.name)),
    [dir.items],
  );
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [rep, setRep] = useState("");
  const [ak, setAk] = useState(false);
  const [saving, setSaving] = useState(false);
  const known = items.some(
    (i) => i.name.trim().toLowerCase() === value.trim().toLowerCase() && !isWalkIn(value),
  );

  function openAdd() {
    const seed = keepWalkIn || isWalkIn(value) ? "" : value.trim();
    setNewName(seed);
    setRep("");
    setAk(false);
    setAdding(true);
  }

  async function confirmAdd(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a customer name.");
      return;
    }
    if (isWalkIn(name)) {
      toast.error("Pick a real account name — Walk-In is not a KatzDesk customer.");
      return;
    }
    setSaving(true);
    try {
      const row = await addDirectoryEntry({ data: { kind: "customer", name } });
      if (rep || ak) {
        await updateCustomerAccount({
          data: { id: row.id, accountRep: rep || null, aviKatz: ak },
        });
      }
      qc.setQueryData<ComboItem[]>(["directory", "customer"], (old) => {
        const list = old ?? [];
        if (list.some((i) => i.id === row.id || i.name.toLowerCase() === row.name.toLowerCase())) {
          return list.map((i) => (i.id === row.id ? row : i));
        }
        return [...list, row].sort((a, b) => a.name.localeCompare(b.name));
      });
      void qc.invalidateQueries({ queryKey: ["directory", "customer"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      onChange(row.name);
      setAdding(false);
      toast.success(`Added ${row.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add customer");
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <form
        className="min-w-[16rem] space-y-2 rounded-lg border border-border bg-muted/40 p-2"
        data-testid="add-customer-form"
        onSubmit={confirmAdd}
      >
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Add customer
        </p>
        <Input
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Customer name"
          aria-label="New customer name"
          disabled={saving || disabled}
        />
        <RepSelect label="Rep" value={rep} onChange={setRep} />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={ak}
            disabled={saving || disabled}
            onChange={(e) => setAk(e.target.checked)}
          />
          Avi Katz account (AK)
          <AkBadge on={ak} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={saving || disabled || !newName.trim()}>
            {saving ? "Adding…" : "Add"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="min-w-0">
      <ComboField
        value={keepWalkIn ? "Walk-In" : value}
        onChange={onChange}
        items={items}
        placeholder={walkIn && !keepWalkIn ? "Pick a customer…" : "Search customers…"}
        allowCreate={false}
        disabled={disabled || keepWalkIn}
        noun="customer"
        emptyHint="No customer matches. Add customer to create an account, or search the list."
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {dir.canAdd ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            data-testid="add-customer"
            disabled={disabled}
            onClick={openAdd}
          >
            Add customer
          </button>
        ) : null}
        {walkIn ? (
          keepWalkIn ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={onClearKeep}
            >
              Choose a customer instead
            </button>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={onKeepWalkIn}
            >
              Keep as Walk-In
            </button>
          )
        ) : null}
        {existingCustomer && !isWalkIn(existingCustomer) ? (
          <span className="text-xs text-muted-foreground">Now: {existingCustomer}</span>
        ) : needsCustomer ? (
          <span className="text-xs text-warning">Pick an account</span>
        ) : !known && value.trim() && !keepWalkIn && !isWalkIn(value) ? (
          <span className="text-xs text-warning">Not on the list — add this customer</span>
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
