import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  applyAccountEquipImport,
  previewAccountEquipImport,
  type EquipPreview,
  type EquipPreviewRow,
} from "@/lib/ops/account-equip-import";
import { isWalkIn, OWNERSHIP_VALUES } from "@/lib/ops/account-equip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboField } from "@/components/ui/combo-field";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useDirectory } from "@/components/desk/directory-fields";

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

export function AccountEquipImportButton({
  onImported,
}: {
  onImported?: (customer: string | null) => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<EquipPreview | null>(null);

  const load = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return previewAccountEquipImport({ data: { filename: file.name, base64 } });
    },
    onSuccess: (data, file) => {
      setFileName(file.name);
      setPreview(data);
      setOpen(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the equipment list"),
  });

  const apply = useMutation({
    mutationFn: (rows: EquipPreview["rows"]) => applyAccountEquipImport({ data: { rows } }),
    onSuccess: (res) => {
      toast.success(
        `Equipment list saved · ${res.added} added · ${res.updated} updated${
          res.catalogAdded ? ` · ${res.catalogAdded} new catalog model${res.catalogAdded === 1 ? "" : "s"}` : ""
        }`,
      );
      setOpen(false);
      setPreview(null);
      const first = preview?.rows.find((r) => r.action !== "skip" && r.customer && !isWalkIn(r.customer));
      onImported?.(first?.customer ?? null);
      void qc.invalidateQueries({ queryKey: ["account-equipment"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["directory"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
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
        {load.isPending ? "Reading…" : "Import equipment list"}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cancel())}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogTitle>Import Equipment List</DialogTitle>
          <DialogDescription>
            {fileName ? `${fileName} · ` : ""}
            This writes machines onto existing accounts. It does not create accounts, tickets, or
            overwrite notes. Unchecked rows are skipped. Walk-In and unmatched rows stay off until
            you pick an account and a catalog model.
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

type RowDraft = {
  selected: boolean;
  customer: string;
  catalogModel: string;
  addCatalog: boolean;
  ownership: string;
};

function draftFor(row: EquipPreviewRow): RowDraft {
  const ready = row.action === "add" || row.action === "update";
  return {
    selected: ready,
    customer: row.customer ?? "",
    catalogModel: row.catalogModel ?? "",
    addCatalog: false,
    ownership: row.ownership ?? "",
  };
}

function PreviewBody({
  preview,
  pending,
  onCancel,
  onConfirm,
}: {
  preview: EquipPreview;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (rows: EquipPreview["rows"]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => {
    const next: Record<string, RowDraft> = {};
    for (const row of preview.rows) next[row.key] = draftFor(row);
    return next;
  });
  const [filter, setFilter] = useState<"all" | "ready" | "review">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement>(null);
  const customers = useDirectory("customer");
  const equipment = useDirectory("equipment");
  const customerItems = useMemo(
    () => customers.items.filter((i) => !isWalkIn(i.name)),
    [customers.items],
  );

  useEffect(() => {
    const next: Record<string, RowDraft> = {};
    for (const row of preview.rows) next[row.key] = draftFor(row);
    setDrafts(next);
  }, [preview]);

  function rowReady(row: EquipPreviewRow, d: RowDraft) {
    const customer = d.customer.trim();
    const model = d.catalogModel.trim();
    if (!customer || isWalkIn(customer)) return false;
    if (!model) return false;
    if (row.foreignAccount && customer.toLowerCase() !== row.foreignAccount.toLowerCase()) return false;
    return true;
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return preview.rows.filter((row) => {
      const d = drafts[row.key] ?? draftFor(row);
      const ready = rowReady(row, d);
      if (filter === "ready" && !ready) return false;
      if (filter === "review" && ready) return false;
      if (!needle) return true;
      return [
        row.fileCustomer,
        d.customer,
        row.equipmentName,
        row.fileModel,
        d.catalogModel,
        row.serial,
        row.ownership,
        ...row.reviewReasons,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [preview.rows, drafts, filter, q]);

  useEffect(() => {
    setPage(0);
  }, [filter, q]);

  const pageSize = 80;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice(page * pageSize, page * pageSize + pageSize);

  const selectedAdds = preview.rows.filter((r) => {
    const d = drafts[r.key];
    return d?.selected && rowReady(r, d) && r.action !== "update";
  }).length;
  const selectedUpdates = preview.rows.filter((r) => {
    const d = drafts[r.key];
    return d?.selected && rowReady(r, d) && r.action === "update";
  }).length;
  const selectedCount = selectedAdds + selectedUpdates;
  const blocked = preview.rows.filter((r) => {
    const d = drafts[r.key];
    return d?.selected && !rowReady(r, d);
  });
  const allSelected =
    preview.rows.length > 0 && preview.rows.every((r) => drafts[r.key]?.selected && rowReady(r, drafts[r.key]!));
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function patch(key: string, next: Partial<RowDraft>) {
    setDrafts((cur) => {
      const prev = cur[key] ?? { selected: false, customer: "", catalogModel: "", addCatalog: false, ownership: "" };
      return { ...cur, [key]: { ...prev, ...next } };
    });
  }

  function setAll(selected: boolean) {
    setDrafts((cur) => {
      const next = { ...cur };
      for (const row of preview.rows) {
        const d = next[row.key] ?? draftFor(row);
        if (selected) {
          next[row.key] = { ...d, selected: rowReady(row, { ...d, selected: true }) };
        } else {
          next[row.key] = { ...d, selected: false };
        }
      }
      return next;
    });
  }

  function confirm() {
    if (blocked.length || selectedCount === 0) return;
    const rows = preview.rows.flatMap((row) => {
      const d = drafts[row.key] ?? draftFor(row);
      if (!d.selected || !rowReady(row, d)) return [];
      const catalogModel = d.catalogModel.trim();
      const known = equipment.items.some((i) => i.name.toLowerCase() === catalogModel.toLowerCase());
      return [
        {
          ...row,
          customer: d.customer.trim(),
          catalogModel,
          addCatalog: d.addCatalog || !known,
          ownership: d.ownership.trim() || null,
          modelCandidates: [],
          reviewReasons: [],
          action: row.action === "update" ? ("update" as const) : ("add" as const),
        },
      ];
    });
    onConfirm(rows);
  }

  return (
    <div className="mt-4" data-equip-import="preview">
      <ul className="grid gap-2 text-sm sm:grid-cols-4">
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{selectedAdds}</span> selected to add
        </li>
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{selectedUpdates}</span> selected to update
        </li>
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{preview.reviewCount}</span> need review
        </li>
        <li className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="font-medium">{preview.rows.length - selectedCount}</span> skipped
        </li>
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setAll(true)}>
          Select ready
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAll(false)}>
          Deselect all
        </Button>
        {(["all", "ready", "review"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === id ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {id === "all" ? "All" : id === "ready" ? "Ready" : "Needs review"}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rows…"
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Search import rows"
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead className="sticky top-0 bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  aria-label="Select all ready rows"
                  onChange={(e) => setAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Catalog model</th>
              <th className="px-3 py-2">Equipment Name</th>
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Install date</th>
              <th className="px-3 py-2">Ownership</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const d = drafts[r.key] ?? draftFor(r);
              const ready = rowReady(r, d);
              const needsReview = !ready;
              const showPickers = needsReview || !!editing[r.key];
              return (
                <tr
                  key={r.key}
                  data-equip-status={needsReview ? "review" : r.action === "update" ? "update" : "matched"}
                  className={`border-t border-border ${needsReview ? "bg-warning/10" : ""}`}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={!!d.selected && ready}
                      disabled={pending || (!ready && !d.selected)}
                      aria-label={`Import ${r.equipmentName || r.fileModel}`}
                      onChange={(e) => {
                        if (e.target.checked && !ready) return;
                        patch(r.key, { selected: e.target.checked });
                      }}
                    />
                  </td>
                  <td className="min-w-[16rem] px-3 py-2 align-top">
                    {showPickers ? (
                      <>
                        <ComboField
                          value={d.customer}
                          onChange={(customer) => {
                            const next = { ...d, customer };
                            patch(r.key, { customer, selected: d.selected || rowReady(r, next) });
                          }}
                          items={customerItems}
                          placeholder="Pick an account…"
                          allowCreate={false}
                          disabled={pending}
                          noun="account"
                          emptyHint="No account matches. Do not create one from this file."
                          menuInFlow
                        />
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          File: {r.fileCustomer || "—"}
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setEditing((cur) => ({ ...cur, [r.key]: true }))}
                      >
                        {d.customer || "—"}
                      </button>
                    )}
                  </td>
                  <td className="min-w-[16rem] px-3 py-2 align-top">
                    {showPickers ? (
                      <>
                        <ComboField
                          value={d.catalogModel}
                          onChange={(catalogModel) => {
                            const known = equipment.items.some(
                              (i) => i.name.toLowerCase() === catalogModel.trim().toLowerCase(),
                            );
                            const next = { ...d, catalogModel, addCatalog: !!catalogModel && !known };
                            patch(r.key, {
                              catalogModel,
                              addCatalog: next.addCatalog,
                              selected: d.selected || rowReady(r, next),
                            });
                          }}
                          items={equipment.items}
                          placeholder="Pick a catalog model…"
                          allowCreate
                          disabled={pending}
                          noun="model"
                          emptyHint="No catalog model. Add this row’s name as a new model, or skip."
                          menuInFlow
                        />
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          File model: {r.fileModel || "—"}
                          {d.addCatalog ? " · will add to catalog" : ""}
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setEditing((cur) => ({ ...cur, [r.key]: true }))}
                      >
                        {d.catalogModel || "—"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-medium">{r.equipmentName || "—"}</span>
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{r.serial || "—"}</td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{r.installDate || "—"}</td>
                  <td className="min-w-[12rem] px-3 py-2 align-top">
                    {showPickers ? (
                      <SelectField
                        allowEmpty
                        emptyLabel="—"
                        value={d.ownership}
                        disabled={pending}
                        onChange={(e) => patch(r.key, { ownership: e.target.value })}
                      >
                        {OWNERSHIP_VALUES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </SelectField>
                    ) : (
                      <span>{d.ownership || "—"}</span>
                    )}
                    {r.ownershipRaw && !r.ownership ? (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">File: {r.ownershipRaw}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="block text-[11px] font-medium tracking-wide uppercase">
                      {needsReview ? "Needs review" : r.action === "update" ? "Update existing" : "Matched"}
                    </span>
                    {r.reviewReasons.map((reason) => (
                      <span key={reason} className="mt-0.5 block text-[11px] text-muted-foreground">
                        {reason}
                      </span>
                    ))}
                    {r.foreignAccount ? (
                      <span className="mt-0.5 block text-[11px] text-warning">On {r.foreignAccount}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                  Nothing in this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {visible.length > pageSize ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min(visible.length, page * pageSize + pageSize)} of {visible.length}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {blocked.length ? (
          <p className="mr-auto max-w-md text-xs text-warning">
            {blocked.length} selected row{blocked.length === 1 ? "" : "s"} still need an account and catalog
            model.
          </p>
        ) : null}
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={pending || selectedCount === 0 || blocked.length > 0} onClick={confirm}>
          {pending ? "Saving…" : "Confirm import"}
        </Button>
      </div>
    </div>
  );
}
