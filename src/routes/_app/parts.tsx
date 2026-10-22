import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hideParts, listParts, removePart, restoreParts, setPartImage, type PartRow } from "@/lib/ops/parts-api";
import { binText } from "@/lib/ops/part-bins";
import { treatResearchedPhoto } from "@/lib/part-photo-treatment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartThumb } from "@/components/desk/part-thumb";
import { PartWindow } from "@/components/desk/part-window";
import {
  PartGetLater,
  PartMpnEditButton,
  PartMpnForm,
  PartNameEditButton,
  PartNameForm,
  PartPhotoButtons,
  PartPhotoFile,
  PartPhotoReview,
  PartPhotoStatus,
} from "@/components/desk/part-controls";
import { partMoney as money, usePartMpnEdit, usePartNameEdit, usePartPhoto } from "@/components/desk/part-edits";
import { FilterChip, ImportMenu } from "@/components/desk/desk-charts";
import { BinLocationsButton, ImportPartsButton, UpdatePricingButton } from "@/components/desk/part-imports";
import { getMyAccess } from "@/lib/ops/access";
import { ListToolbar, ToolbarNote, ToolbarSearch, ToolbarSelect } from "@/components/desk/list-toolbar";
import { notLoadedText } from "@/lib/ops/load-problem";

/** `?part=<id>` opens that part's window, so a part can be linked. */
type PartsSearch = { part?: number };

function parsePartsSearch(s: Record<string, unknown>): PartsSearch {
  const n = typeof s.part === "number" ? s.part : typeof s.part === "string" && s.part.trim() ? Number(s.part) : NaN;
  return Number.isInteger(n) && n > 0 ? { part: n } : {};
}

export const Route = createFileRoute("/_app/parts")({ validateSearch: parsePartsSearch, component: Page });

function hiddenWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Page() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/parts" });
  // The open window lives in the address (?part=), so a link opens it. Opening and closing replace the entry, as the
  // other windows do, so Back never gets stuck on Parts. The list does not jump.
  const openPart = (id: number) => void navigate({ search: (s) => ({ ...s, part: id }), replace: true, resetScroll: false });
  const closePart = () => void navigate({ search: (s) => ({ ...s, part: undefined }), replace: true, resetScroll: false });
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const isAdmin = !!me.data?.isAdmin || me.data?.role === "admin";
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [noPhoto, setNoPhoto] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [getLater, setGetLater] = useState(false);
  const [itemClass, setItemClass] = useState("");
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
    queryKey: ["parts", term, noPhoto, showHidden, getLater, itemClass, offset],
    queryFn: () => listParts({ data: { q: term, noPhoto, hidden: showHidden, getLater, itemClass: itemClass || undefined, offset } }),
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
  const resetPaging = () => {
    setOffset(0);
    setExtra([]);
  };

  // Every part whose photo research confirmed one photo (same MPN on 3+ agreeing sources) and has none attached yet:
  // fetched, given the standard treatment, and saved. Anything that fails stays flagged Confirm Photo.
  const [pulling, setPulling] = useState<string | null>(null);
  async function pullConfirmed() {
    setPulling("Finding parts…");
    let done = 0;
    let failed = 0;
    try {
      let offsetAt = 0;
      const todo: PartRow[] = [];
      for (;;) {
        const p = await listParts({ data: { noPhoto: true, offset: offsetAt } });
        todo.push(...p.rows.filter((r) => r.research?.verdict === "confirmed" && r.research.imageUrl));
        if (p.rows.length < 50) break;
        offsetAt += 50;
      }
      for (const r of todo) {
        setPulling(`Pulling ${done + failed + 1} of ${todo.length}…`);
        try {
          const base64 = await treatResearchedPhoto(r.id, -1);
          await setPartImage({ data: { id: r.id, base64, sourceUrl: r.research!.imageUrl } });
          done += 1;
        } catch {
          failed += 1;
        }
      }
      toast.success(`${done} confirmed photo${done === 1 ? "" : "s"} attached${failed ? `; ${failed} could not be reached and stay flagged Confirm Photo` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not pull the photos");
    } finally {
      setPulling(null);
      refresh();
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Parts</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            The NetSuite item list with each part's photo and MPN. Hide an obsolete part to take it off this list and the invoice picker. A ticket that already used it keeps the line.
          </p>
        </div>
        {/* Admin: Pull Confirmed Photos and every import. Sales: Bin Locations only, like a bin edit in the part's window. */}
        {isAdmin || page.data?.canEditMpn ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {isAdmin && page.data?.readyToPull ? (
              <Button type="button" size="sm" variant="outline" disabled={!!pulling} onClick={() => void pullConfirmed()} data-testid="parts-pull-confirmed">
                <Camera className="size-4" />
                {pulling ?? `Pull Confirmed Photos (${page.data.readyToPull})`}
              </Button>
            ) : null}
            <ImportMenu>
              {isAdmin ? <ImportPartsButton /> : null}
              {isAdmin ? <UpdatePricingButton /> : null}
              <BinLocationsButton />
            </ImportMenu>
          </div>
        ) : null}
      </header>

      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search part number or name…" label="Search parts" testId="parts-search" />
        <FilterChip
          selected={noPhoto}
          data-testid="parts-confirm-photo"
          onClick={() => {
            setNoPhoto(!noPhoto);
            resetPaging();
          }}
        >
          Confirm Photo
        </FilterChip>
        <FilterChip
          selected={getLater}
          data-testid="parts-get-later-filter"
          onClick={() => {
            setGetLater(!getLater);
            resetPaging();
          }}
        >
          Get Later · {(page.data?.getLaterCount ?? 0).toLocaleString()}
        </FilterChip>
        {page.data?.classes.length ? (
          <ToolbarSelect
            value={itemClass}
            onChange={(e) => {
              setItemClass(e.target.value);
              resetPaging();
            }}
            allowEmpty
            emptyLabel="All classes"
            aria-label="Filter by class"
            className="w-56"
            data-testid="parts-class-filter"
          >
            {page.data.classes.map((c) => (
              <option key={c} value={c}>
                {c} · {(page.data?.classCounts?.[c] ?? 0).toLocaleString()}
              </option>
            ))}
          </ToolbarSelect>
        ) : null}
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
            onOpen={openPart}
          />
        ))}
        {!rows.length && !page.isLoading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            {notLoadedText(page, "parts") ?? (showHidden ? "No hidden parts." : "No parts match. Import the NetSuite item list from the Service page first.")}
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

      <PartWindow
        id={search.part ?? null}
        initial={rows.find((r) => r.id === search.part)}
        canEditMpn={!!page.data?.canEditMpn}
        onClose={closePart}
        onChanged={refresh}
      />
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
  onOpen,
}: {
  row: PartRow;
  canEditMpn: boolean;
  canHide: boolean;
  canRemove: boolean;
  showHidden: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
  onChanged: () => void;
  /** Opens the part's window. */
  onOpen: (id: number) => void;
}) {
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [removeNote, setRemoveNote] = useState<string | null>(null);
  const photo = usePartPhoto(row, onChanged);
  const mpn = usePartMpnEdit(row, onChanged);
  const name = usePartNameEdit(row, onChanged);
  const bin = binText({ rack: row.binRack, shelf: row.binShelf, bin: row.binBin });
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
    // Phones: the checkbox and photo float at the top left; the name and part # run beside them, and everything
    // below (meta, forms, the action buttons) uses the full width under the photo. sm and up stay a flex row.
    <li className="flex gap-3 p-3 max-sm:flow-root sm:p-4" data-testid="part-row" data-sku={row.sku} data-hidden={showHidden ? "1" : "0"}>
      {canHide && !showHidden ? (
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 max-sm:float-left max-sm:mr-3"
          checked={selected}
          aria-label={`Select ${row.item}`}
          data-testid="part-select"
          onChange={() => onToggle(row.id)}
        />
      ) : null}
      <PartThumb
        part={{ id: row.id, sku: row.sku, mpn: row.mpn, hasImage: row.hasImage, imageVersion: row.imageVersion }}
        name={row.item}
        size="lg"
        onOpen={() => onOpen(row.id)}
        className="max-sm:float-left max-sm:mr-3 max-sm:mb-2 max-sm:size-20"
      />
      <div className="min-w-0 flex-1">
        {/* Part name is the NetSuite Description; blank when none is stored. A click opens the part's window. */}
        <p className="font-medium break-words" data-testid="part-name">
          {row.description ? (
            <button type="button" className="max-w-full text-left break-words hover:underline focus-visible:underline focus-visible:outline-none max-sm:block" onClick={() => onOpen(row.id)} data-testid="part-open">
              {row.description}
            </button>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="part-mpn">
          Part # {row.mpn ? <span className="font-medium text-foreground">{row.mpn}</span> : <span>not set</span>}
          {row.rate != null ? ` · ${money(row.rate)}` : ""}
          {row.listPrice != null ? <span data-testid="part-list-price"> · Mfr {money(row.listPrice)}</span> : null}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {row.itemClass ? (
            <span className="text-muted-foreground" data-testid="part-class">
              <span className="font-medium tracking-wide uppercase">Class</span> {row.itemClass}
            </span>
          ) : null}
          {bin ? (
            <span className="text-muted-foreground" data-testid="part-bin">
              <span className="font-medium tracking-wide uppercase">Bin</span> {bin}
            </span>
          ) : null}
          <PartGetLater row={row} onChanged={onChanged} />
          <PartPhotoStatus row={row} photo={photo} />
        </div>
        <PartPhotoReview row={row} photo={photo} onChanged={onChanged} />
        <PartNameForm row={row} edit={name} />
        {showHidden ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="part-hidden-meta">
            Hidden by {row.hiddenBy || "Desk"}
            {row.hiddenAt ? ` on ${hiddenWhen(row.hiddenAt)}` : ""}
            {" · "}
            {row.hiddenReason || "No reason given"}
          </p>
        ) : null}

        <PartMpnForm row={row} edit={mpn} />

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

        <div className="mt-2 flex flex-wrap items-center gap-2 max-sm:clear-left">
          <PartPhotoButtons row={row} photo={photo} />
          {canEditMpn ? <PartMpnEditButton row={row} edit={mpn} /> : null}
          {canEditMpn ? <PartNameEditButton row={row} edit={name} /> : null}
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
          <PartPhotoFile photo={photo} />
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
