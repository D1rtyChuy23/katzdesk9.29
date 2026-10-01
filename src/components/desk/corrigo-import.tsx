import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyCorrigoImport, previewCorrigoImport } from "@/lib/ops/corrigo-import";
import type { CorrigoApplyResult, CorrigoPreview } from "@/lib/ops/corrigo-import";
import { isWalkIn, type CorrigoPreviewRow } from "@/lib/ops/corrigo";
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

export type CorrigoReviewItem = CorrigoApplyResult["review"][number];

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
      const base64 = await fileToBase64(file);
      return previewCorrigoImport({ data: { filename: file.name, base64 } });
    },
    onSuccess: (data, file) => {
      setFileName(file.name);
      setPreview(data);
      setOpen(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the report"),
  });

  const apply = useMutation({
    mutationFn: (rows: CorrigoPreview["rows"]) => applyCorrigoImport({ data: { rows } }),
    onSuccess: (res) => {
      toast.success(
        `Corrigo import saved · ${res.updated} updated · ${res.created} created`,
      );
      setOpen(false);
      setPreview(null);
      onImported(res.review);
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not import"),
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
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) load.mutate(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={load.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {load.isPending ? "Reading…" : "Import Corrigo report"}
      </Button>

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
  keepWalkIn: boolean;
};

function draftFor(row: CorrigoPreviewRow): RowDraft {
  const applicable = row.action === "update" || row.action === "create";
  return {
    selected: applicable,
    customer: row.customer ?? "",
    keepWalkIn: false,
  };
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

  const applicable = preview.rows.filter((r) => r.action === "update" || r.action === "create");
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
    const name = d.customer.trim();
    return !name || isWalkIn(name);
  });

  function patch(key: string, next: Partial<RowDraft>) {
    setDrafts((cur) => {
      const prev = cur[key] ?? { selected: false, customer: "", keepWalkIn: false };
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
    const rows = preview.rows.map((row) => {
      const d = drafts[rowKey(row)];
      const applicableRow = row.action === "update" || row.action === "create";
      if (!applicableRow || !d?.selected) return { ...row, action: "skip" as const };
      const customer = d.keepWalkIn ? "Walk-In" : d.customer.trim() || row.customer;
      return { ...row, customer };
    });
    onConfirm(rows);
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
          {preview.unmapped.length
            ? `${preview.unmapped.length} unmapped status${preview.unmapped.length === 1 ? "" : "es"}`
            : "No unmapped statuses"}
        </li>
      </ul>
      {preview.wrapCount ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.wrapCount} ST#{preview.wrapCount === 1 ? "" : "s"} reused a number after WO-9999 —
          those stay on For review so nobody merges two different jobs
          {preview.conflictCount
            ? ` · ${preview.conflictCount} already on more than one ticket`
            : ""}
          {preview.skipped
            ? ` · ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} with no ST#`
            : ""}
          .
        </p>
      ) : preview.conflictCount ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.conflictCount} WO conflict{preview.conflictCount === 1 ? "" : "s"} already on more
          than one ticket — import updates the original and flags the rest to merge
          {preview.skipped
            ? ` · ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} with no ST#`
            : ""}
          .
        </p>
      ) : preview.skipped ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.skipped} row{preview.skipped === 1 ? "" : "s"} with no ST#.
        </p>
      ) : null}
      {preview.unmapped.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Unmapped: {preview.unmapped.join(", ")}. Existing tickets keep their KatzDesk status;
          new tickets open as Open.
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
            {preview.rows.map((r) => {
              const key = rowKey(r);
              const d = drafts[key] ?? draftFor(r);
              const locked = r.action === "skip";
              const walkIn = r.fileWalkIn;
              const needsCustomer =
                !locked &&
                d.selected &&
                walkIn &&
                !d.keepWalkIn &&
                (!d.customer.trim() || isWalkIn(d.customer));
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
                        Repeated after 9999
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
                      <span>{d.customer || r.customer || "—"}</span>
                    ) : (
                      <ImportCustomerPicker
                        value={d.keepWalkIn ? "Walk-In" : d.customer}
                        walkIn={walkIn}
                        keepWalkIn={d.keepWalkIn}
                        needsCustomer={needsCustomer}
                        existingCustomer={r.existingCustomer}
                        disabled={pending}
                        onChange={(customer) =>
                          patch(key, {
                            customer,
                            keepWalkIn: isWalkIn(customer) ? d.keepWalkIn : false,
                          })
                        }
                        onKeepWalkIn={() => patch(key, { keepWalkIn: true, customer: "Walk-In" })}
                        onClearKeep={() => patch(key, { keepWalkIn: false, customer: "" })}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.oldStatus ? `${r.oldStatus} → ${r.newStatus}` : r.newStatus}
                    {r.statusUnmapped ? (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        unmapped: {r.statusUnmapped}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">{r.technician || "—"}</td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{r.completedAt || "—"}</td>
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
            Open work from the last Corrigo file, plus ST#s that reused a number after WO-9999.
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
                  {item.entityType && item.entityType !== "service" ? ` · ${item.entityType}` : ""}
                  {item.technician ? ` · ${item.technician}` : ""}
                  {item.reason === "wrap" ? " · repeated after 9999" : ""}
                </span>
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
