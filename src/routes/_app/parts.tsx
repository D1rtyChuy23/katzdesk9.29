import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearPartImage, listParts, setPartImage, setPartMpn, type PartRow } from "@/lib/ops/parts-api";
import { resizeImageToBase64 } from "@/lib/image-resize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartThumb } from "@/components/desk/part-thumb";
import { FilterChip } from "@/components/desk/desk-charts";
import { ListToolbar, ToolbarNote, ToolbarSearch } from "@/components/desk/list-toolbar";

export const Route = createFileRoute("/_app/parts")({ component: Page });

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Page() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [noPhoto, setNoPhoto] = useState(false);
  const [offset, setOffset] = useState(0);
  const [extra, setExtra] = useState<PartRow[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setOffset(0);
      setExtra([]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const page = useQuery({
    queryKey: ["parts", term, noPhoto, offset],
    queryFn: () => listParts({ data: { q: term, noPhoto, offset } }),
  });
  const rows = offset === 0 ? (page.data?.rows ?? []) : [...extra, ...(page.data?.rows ?? [])];
  const total = page.data?.total ?? 0;

  const refresh = () => {
    setOffset(0);
    setExtra([]);
    void qc.invalidateQueries({ queryKey: ["parts"] });
    void qc.invalidateQueries({ queryKey: ["billing-items"] });
    void qc.invalidateQueries({ queryKey: ["charges"] });
  };

  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Parts</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          The NetSuite item list with each part's photo and MPN. The photo you add here is the one the invoice picker shows.
        </p>
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
        <ToolbarNote data-testid="parts-count">
          {page.isLoading ? "Loading…" : `${total.toLocaleString()} part${total === 1 ? "" : "s"} · ${(page.data?.withPhoto ?? 0).toLocaleString()} with a photo`}
        </ToolbarNote>
      </ListToolbar>

      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card" data-testid="parts-list">
        {rows.map((r) => (
          <PartRowView key={r.id} row={r} canEditMpn={!!page.data?.canEditMpn} onChanged={refresh} />
        ))}
        {!rows.length && !page.isLoading ? <li className="px-4 py-6 text-sm text-muted-foreground">No parts match. Import the NetSuite item list from the Service page first.</li> : null}
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

function PartRowView({ row, canEditMpn, onChanged }: { row: PartRow; canEditMpn: boolean; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [mpn, setMpn] = useState(row.mpn ?? "");
  useEffect(() => setMpn(row.mpn ?? ""), [row.mpn]);

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

  return (
    <li className="flex gap-3 p-3 sm:p-4" data-testid="part-row" data-sku={row.sku}>
      <PartThumb part={{ id: row.id, sku: row.sku, mpn: row.mpn, hasImage: row.hasImage, imageVersion: row.imageVersion }} name={row.item} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{row.item}</p>
        <p className="text-sm text-muted-foreground" data-testid="part-mpn">
          MPN {row.mpn ? <span className="font-medium text-foreground">{row.mpn}</span> : <span>not set</span>}
          {row.rate != null ? ` · ${money(row.rate)}` : ""}
        </p>
        {row.description ? <p className="mt-0.5 text-sm break-words text-muted-foreground">{row.description}</p> : null}

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
      </div>
    </li>
  );
}
