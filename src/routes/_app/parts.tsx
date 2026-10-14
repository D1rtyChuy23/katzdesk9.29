import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearPartImage, hideParts, listParts, removePart, restoreParts, setPartDescription, setPartImage, setPartMpn, type PartRow } from "@/lib/ops/parts-api";
import { resizeImageToBase64 } from "@/lib/image-resize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartThumb } from "@/components/desk/part-thumb";
import { FilterChip, ImportMenu } from "@/components/desk/desk-charts";
import { ImportPartsButton, UpdatePricingButton } from "@/components/desk/part-imports";
import { getMyAccess } from "@/lib/ops/access";
import { ListToolbar, ToolbarNote, ToolbarSearch } from "@/components/desk/list-toolbar";

export const Route = createFileRoute("/_app/parts")({ component: Page });

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function hiddenWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Page() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const isAdmin = !!me.data?.isAdmin || me.data?.role === "admin";
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [noPhoto, setNoPhoto] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const [extra, setExtra] = useState<PartRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkReason, setBulkReason] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setOffset(0);
      setExtra([]);
      setSelected([]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const page = useQuery({
    queryKey: ["parts", term, noPhoto, showHidden, offset],
    queryFn: () => listParts({ data: { q: term, noPhoto, hidden: showHidden, offset } }),
  });
  const rows = offset === 0 ? (page.data?.rows ?? []) : [...extra, ...(page.data?.rows ?? [])];
  const total = page.data?.total ?? 0;
  const hiddenCount = page.data?.hiddenCount ?? 0;
  const canHide = !!page.data?.canHide;
  const canRemove = !!page.data?.canRemove;

  const refresh = () => {
    setOffset(0);
    setExtra([]);
    void qc.invalidateQueries({ queryKey: ["parts"] });
    void qc.invalidateQueries({ queryKey: ["billing-items"] });
    void qc.invalidateQueries({ queryKey: ["charges"] });
  };

  const hideSelected = useMutation({
    mutationFn: () => hideParts({ data: { ids: selected, reason: bulkReason.trim() || undefined } }),
    onSuccess: (r) => {
      toast.success(r.hidden === 1 ? "Part hidden" : `${r.hidden} parts hidden`);
      setSelected([]);
      setBulkReason("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not hide those parts"),
  });

  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Parts</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            The NetSuite item list with each part's photo and MPN. Hide an obsolete part to take it off this list and the invoice picker. A ticket that already used it keeps the line.
          </p>
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <ImportMenu>
              <ImportPartsButton />
              <UpdatePricingButton />
            </ImportMenu>
          </div>
        ) : null}
      </header>

      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search SKU, MPN or description…" label="Search parts" testId="parts-search" />
        <FilterChip
          selected={noPhoto}
          onClick={() => {
            setNoPhoto(!noPhoto);
            setOffset(0);
            setExtra([]);
          }}
        >
          No Photo Yet
        </FilterChip>
        <FilterChip
          selected={showHidden}
          data-testid="parts-show-hidden"
          onClick={() => {
            setShowHidden(!showHidden);
            setOffset(0);
            setExtra([]);
            setSelected([]);
          }}
        >
          Show Hidden · {hiddenCount.toLocaleString()}
        </FilterChip>
        <ToolbarNote data-testid="parts-count">
          {page.isLoading
            ? "Loading…"
            : showHidden
              ? `${total.toLocaleString()} hidden part${total === 1 ? "" : "s"}`
              : `${total.toLocaleString()} part${total === 1 ? "" : "s"} · ${(page.data?.withPhoto ?? 0).toLocaleString()} with a photo`}
        </ToolbarNote>
      </ListToolbar>

      {canHide && !showHidden && selected.length ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          data-testid="parts-bulk-hide"
          onSubmit={(e) => {
            e.preventDefault();
            hideSelected.mutate();
          }}
        >
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <Input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Reason, optional"
            aria-label="Reason for hiding the selected parts"
            className="h-9 w-72"
            data-testid="parts-bulk-reason"
          />
          <Button type="submit" size="sm" disabled={hideSelected.isPending}>
            <EyeOff className="size-4" />
            {hideSelected.isPending ? "Hiding…" : "Hide"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </form>
      ) : null}

      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card" data-testid="parts-list">
        {rows.map((r) => (
          <PartRowView
            key={r.id}
            row={r}
            canEditMpn={!!page.data?.canEditMpn}
            canHide={canHide}
            canRemove={canRemove}
            showHidden={showHidden}
            selected={selected.includes(r.id)}
            onToggle={toggle}
            onChanged={refresh}
          />
        ))}
        {!rows.length && !page.isLoading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            {showHidden ? "No hidden parts." : "No parts match. Import the NetSuite item list from the Service page first."}
          </li>
        ) : null}
      </ul>

      {rows.length < total ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page.isFetching}
            onClick={() => {
              setExtra(rows);
              setOffset(rows.length);
            }}
          >
            Show More
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PartRowView({
  row,
  canEditMpn,
  canHide,
  canRemove,
  showHidden,
  selected,
  onToggle,
  onChanged,
}: {
  row: PartRow;
  canEditMpn: boolean;
  canHide: boolean;
  canRemove: boolean;
  showHidden: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [removeNote, setRemoveNote] = useState<string | null>(null);
  const [mpn, setMpn] = useState(row.mpn ?? "");
  useEffect(() => setMpn(row.mpn ?? ""), [row.mpn]);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(row.description ?? "");
  useEffect(() => setDesc(row.description ?? ""), [row.description]);
  const saveDesc = useMutation({
    mutationFn: () => setPartDescription({ data: { id: row.id, description: desc.trim() || null } }),
    onSuccess: () => {
      setEditingDesc(false);
      toast.success(desc.trim() ? "Description saved" : "Description cleared");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the description"),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => setPartImage({ data: { id: row.id, base64: await resizeImageToBase64(file) } }),
    onSuccess: () => {
      toast.success(row.hasImage ? "Photo replaced" : "Photo added");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the photo"),
  });
  const remove = useMutation({
    mutationFn: () => clearPartImage({ data: { id: row.id } }),
    onSuccess: () => {
      toast.success("Photo removed");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the photo"),
  });
  const saveMpn = useMutation({
    mutationFn: () => setPartMpn({ data: { id: row.id, mpn: mpn.trim() || null } }),
    onSuccess: () => {
      setEditing(false);
      toast.success("MPN saved");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the MPN"),
  });
  const hide = useMutation({
    mutationFn: () => hideParts({ data: { ids: [row.id], reason: reason.trim() || undefined } }),
    onSuccess: () => {
      setHiding(false);
      setReason("");
      toast.success("Part hidden");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not hide this part"),
  });
  const restore = useMutation({
    mutationFn: () => restoreParts({ data: { ids: [row.id] } }),
    onSuccess: () => {
      toast.success("Part restored");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not restore this part"),
  });
  const drop = useMutation({
    mutationFn: () => removePart({ data: { id: row.id } }),
    onSuccess: () => {
      setRemoveNote(null);
      toast.success("Part removed");
      onChanged();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Could not remove this part";
      setRemoveNote(message);
      toast.error(message);
    },
  });

  return (
    <li className="flex gap-3 p-3 sm:p-4" data-testid="part-row" data-sku={row.sku} data-hidden={showHidden ? "1" : "0"}>
      {canHide && !showHidden ? (
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={selected}
          aria-label={`Select ${row.item}`}
          data-testid="part-select"
          onChange={() => onToggle(row.id)}
        />
      ) : null}
      <PartThumb part={{ id: row.id, sku: row.sku, mpn: row.mpn, hasImage: row.hasImage, imageVersion: row.imageVersion }} name={row.item} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{row.item}</p>
        <p className="text-sm text-muted-foreground" data-testid="part-mpn">
          MPN {row.mpn ? <span className="font-medium text-foreground">{row.mpn}</span> : <span>not set</span>}
          {row.rate != null ? ` · ${money(row.rate)}` : ""}
          {row.listPrice != null ? <span data-testid="part-list-price"> · Mfr {money(row.listPrice)}</span> : null}
        </p>
        {/* Description: what is stored, or blank. Nothing is filled in for a part that has none. */}
        <p className="mt-0.5 text-sm break-words text-muted-foreground" data-testid="part-description">
          {row.description ? (
            <>
              <span className="text-[11px] font-medium tracking-wide uppercase">Description</span> <span className="text-foreground/80">{row.description}</span>
            </>
          ) : null}
        </p>
        {editingDesc ? (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveDesc.mutate();
            }}
            data-testid="part-description-form"
          >
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              aria-label={`Description for ${row.item}`}
              placeholder="What this part is"
              maxLength={500}
              className="h-9 w-full sm:w-96"
              autoFocus
              data-testid="part-description-input"
            />
            <Button type="submit" size="sm" disabled={saveDesc.isPending} data-testid="part-description-save">
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDesc(row.description ?? "");
                setEditingDesc(false);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : null}
        {showHidden ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="part-hidden-meta">
            Hidden by {row.hiddenBy || "Desk"}
            {row.hiddenAt ? ` on ${hiddenWhen(row.hiddenAt)}` : ""}
            {" · "}
            {row.hiddenReason || "No reason given"}
          </p>
        ) : null}

        {editing ? (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMpn.mutate();
            }}
          >
            <Input value={mpn} onChange={(e) => setMpn(e.target.value)} aria-label={`MPN for ${row.item}`} placeholder="Manufacturer part number" className="h-9 w-56" autoFocus />
            <Button type="submit" size="sm" disabled={saveMpn.isPending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : null}

        {hiding ? (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            data-testid="part-hide-form"
            onSubmit={(e) => {
              e.preventDefault();
              hide.mutate();
            }}
          >
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label={`Reason for hiding ${row.item}`}
              placeholder="Obsolete, replaced by SKU 123"
              className="h-9 w-72"
              autoFocus
              data-testid="part-hide-reason"
            />
            <Button type="submit" size="sm" disabled={hide.isPending} data-testid="part-hide-confirm">
              {hide.isPending ? "Hiding…" : "Hide"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setHiding(false)}>
              Cancel
            </Button>
          </form>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => fileRef.current?.click()} data-testid="part-photo-add">
            <Camera className="size-4" />
            {upload.isPending ? "Saving…" : row.hasImage ? "Replace Photo" : "Add Photo"}
          </Button>
          {row.hasImage ? (
            <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate()}>
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : null}
          {canEditMpn && !editing ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              {row.mpn ? "Edit MPN" : "Set MPN"}
            </Button>
          ) : null}
          {canEditMpn && !editingDesc ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingDesc(true)} data-testid="part-description-edit">
              <Pencil className="size-4" />
              {row.description ? "Edit Description" : "Add Description"}
            </Button>
          ) : null}
          {canHide && showHidden ? (
            <Button type="button" size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate()} data-testid="part-restore">
              <RotateCcw className="size-4" />
              {restore.isPending ? "Restoring…" : "Restore"}
            </Button>
          ) : null}
          {canHide && !showHidden && !hiding ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setHiding(true)} data-testid="part-hide">
              <EyeOff className="size-4" />
              Hide
            </Button>
          ) : null}
          {canRemove ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={drop.isPending}
              data-testid="part-remove"
              onClick={() => {
                setRemoveNote(null);
                const ok = window.confirm(`Remove ${row.item} for good? This cannot be undone. A part that has been on a ticket or a quote can only be hidden.`);
                if (ok) drop.mutate();
              }}
            >
              <Trash2 className="size-4" />
              Remove Part
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="part-photo-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload.mutate(f);
            }}
          />
        </div>
        {removeNote ? (
          <p className="mt-2 text-sm text-destructive" data-testid="part-remove-refused">
            {removeNote}
          </p>
        ) : null}
      </div>
    </li>
  );
}
