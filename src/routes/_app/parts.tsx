import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, EyeOff, MapPin, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hideParts, listParts, removePart, restoreParts, setPartImage, type PartRow } from "@/lib/ops/parts-api";
import { PARTS_PICK_MAX, binText } from "@/lib/ops/part-bins";
import { treatResearchedPhoto } from "@/lib/part-photo-treatment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartThumb } from "@/components/desk/part-thumb";
import { PartWindow } from "@/components/desk/part-window";
import {
  PartBinForm,
  PartBinMoveButton,
  PartClassSelect,
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
import { partMoney as money, usePartBinEdit, usePartClassEdit, usePartMpnEdit, usePartNameEdit, usePartPhoto } from "@/components/desk/part-edits";
import { MoveBinsDialog, SetClassPicker } from "@/components/desk/part-picks";
import { FilterChip, ImportMenu } from "@/components/desk/desk-charts";
import { BinLocationsButton, ImportPartsButton, ImportPhotoResearchButton, ImportWoPartLinesButton, UpdatePricingButton } from "@/components/desk/part-imports";
import { CleanUpImportCopiesButton, ImportPartMergesButton } from "@/components/desk/part-cleanup";
import { ImportPartNotesButton } from "@/components/desk/part-notes-import";
import { getMyAccess } from "@/lib/ops/access";
import { ListToolbar, ToolbarNote, ToolbarSearch, ToolbarSelect } from "@/components/desk/list-toolbar";
import { notLoadedText } from "@/lib/ops/load-problem";
import { getPartUsageCounts } from "@/lib/ops/part-usage-api";
import type { UsageTotals } from "@/lib/ops/part-usage";
import { PartUsageLine } from "@/components/desk/part-usage";
import { PartUsageReport } from "@/components/desk/part-usage-report";
import { PartsExportButton } from "@/components/desk/parts-export-button";

/** `?part=<id>` opens that part's window, so a part can be linked; `?view=usage` shows the Usage report. */
type PartsSearch = { part?: number; view?: "usage" };

function parsePartsSearch(s: Record<string, unknown>): PartsSearch {
  const n = typeof s.part === "number" ? s.part : typeof s.part === "string" && s.part.trim() ? Number(s.part) : NaN;
  return { ...(Number.isInteger(n) && n > 0 ? { part: n } : {}), ...(s.view === "usage" ? { view: "usage" as const } : {}) };
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
  const [sort, setSort] = useState<"sku" | "used">("sku");
  const [offset, setOffset] = useState(0);
  const [extra, setExtra] = useState<PartRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [moving, setMoving] = useState(false);

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
    queryKey: ["parts", term, noPhoto, showHidden, getLater, itemClass, sort, offset],
    queryFn: () => listParts({ data: { q: term, noPhoto, hidden: showHidden, getLater, itemClass: itemClass || undefined, sort, offset } }),
  });
  const rows = offset === 0 ? (page.data?.rows ?? []) : [...extra, ...(page.data?.rows ?? [])];
  const usageView = search.view === "usage";
  const setView = (v: "items" | "usage") =>
    void navigate({ search: (s) => ({ ...s, view: v === "usage" ? ("usage" as const) : undefined }), replace: true, resetScroll: false });
  // Each part's tickets and pieces, all time (Chuy, 10/28). Read after the list, so the list shows at once.
  const ids = rows.map((r) => r.id);
  const usage = useQuery({
    queryKey: ["part-usage-counts", ids],
    queryFn: () => getPartUsageCounts({ data: { ids } }),
    enabled: ids.length > 0 && !usageView,
    staleTime: 60_000,
    // Show More reads the new parts too: the ones already shown keep their numbers meanwhile.
    placeholderData: (prev) => prev,
  });
  const total = page.data?.total ?? 0;
  const hiddenCount = page.data?.hiddenCount ?? 0;
  const canHide = !!page.data?.canHide;
  const canRemove = !!page.data?.canRemove;
  // The bin location and the Class: Admin only for now (Chuy, 10/28).
  const canEditBins = !!page.data?.canEditBins;
  const canEditClass = !!page.data?.canEditClass;

  const refresh = () => {
    setOffset(0);
    setExtra([]);
    void qc.invalidateQueries({ queryKey: ["parts"] });
    void qc.invalidateQueries({ queryKey: ["billing-items"] });
    void qc.invalidateQueries({ queryKey: ["charges"] });
    void qc.invalidateQueries({ queryKey: ["part-usage-counts"] });
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
  const picked = new Set(selected);
  const selectAllShown = () => setSelected((cur) => [...new Set([...cur, ...rows.map((r) => r.id)])]);
  const tooMany = selected.length > PARTS_PICK_MAX;
  const donePicking = () => {
    setSelected([]);
    refresh();
  };
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
            The NetSuite item list with each part's photo and MPN, and how many tickets used it. Hide an obsolete part to take it off this list and the invoice picker. A ticket that already used it keeps the line.
          </p>
        </div>
        {/* Admin: Pull Confirmed Photos, Export CSV and every import, Bin Locations included (bins are Admin only for now). */}
        {isAdmin || canEditBins ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* The parts list as a file (10/29): the whole list with the hidden parts, or Filtered only. */}
            {isAdmin && !usageView ? <PartsExportButton itemClass={itemClass} q={term} /> : null}
            {isAdmin && page.data?.readyToPull ? (
              <Button type="button" size="sm" variant="outline" disabled={!!pulling} onClick={() => void pullConfirmed()} data-testid="parts-pull-confirmed">
                <Camera className="size-4" />
                {pulling ?? `Pull Confirmed Photos (${page.data.readyToPull})`}
              </Button>
            ) : null}
            <ImportMenu>
              {isAdmin ? <ImportPartsButton /> : null}
              {isAdmin ? <UpdatePricingButton /> : null}
              {isAdmin ? <ImportPhotoResearchButton /> : null}
              {isAdmin ? <ImportWoPartLinesButton /> : null}
              {isAdmin ? <CleanUpImportCopiesButton /> : null}
              {isAdmin ? <ImportPartMergesButton /> : null}
              {isAdmin ? <ImportPartNotesButton /> : null}
              {canEditBins ? <BinLocationsButton /> : null}
            </ImportMenu>
          </div>
        ) : null}
      </header>

      <div className="mt-4 flex flex-wrap gap-2" data-testid="parts-views">
        <FilterChip selected={!usageView} onClick={() => setView("items")} data-testid="parts-view-items">
          Items
        </FilterChip>
        <FilterChip selected={usageView} onClick={() => setView("usage")} data-testid="parts-view-usage">
          Usage report
        </FilterChip>
      </div>

      {usageView ? (
        <PartUsageReport classes={page.data?.classes ?? []} onOpen={openPart} />
      ) : (
        <>
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
            <ToolbarSelect
              value={sort}
              onChange={(e) => {
                setSort(e.target.value === "used" ? "used" : "sku");
                resetPaging();
              }}
              aria-label="Sort parts"
              data-testid="parts-sort"
            >
              <option value="sku">Sort: Part #</option>
              <option value="used">Sort: Most used</option>
            </ToolbarSelect>
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
            // What to do with the picked parts: Hide (Admin and Sales), Move Bin and Set Class (Admin).
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="parts-bulk">
              <span className="text-sm text-muted-foreground" data-testid="parts-selected-count">
                {selected.length.toLocaleString()} selected
              </span>
              {rows.some((r) => !picked.has(r.id)) ? (
                <Button type="button" size="sm" variant="ghost" onClick={selectAllShown} data-testid="parts-select-all">
                  Select All Shown ({rows.length.toLocaleString()})
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])} data-testid="parts-select-clear">
                Clear
              </Button>
              {tooMany ? (
                <span className="text-sm text-destructive" data-testid="parts-too-many">
                  Pick up to {PARTS_PICK_MAX.toLocaleString()} parts at a time.
                </span>
              ) : (
                <>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    data-testid="parts-bulk-hide"
                    onSubmit={(e) => {
                      e.preventDefault();
                      // Select All Shown makes a big Hide one click away, and Restore brings parts back one at a time.
                      const n = selected.length;
                      if (n > 25 && !window.confirm(`Hide ${n.toLocaleString()} parts? Each one comes back from Show Hidden with its own Restore.`)) return;
                      hideSelected.mutate();
                    }}
                  >
                    <Input
                      value={bulkReason}
                      onChange={(e) => setBulkReason(e.target.value)}
                      placeholder="Reason, optional"
                      aria-label="Reason for hiding the selected parts"
                      className="h-9 w-60"
                      data-testid="parts-bulk-reason"
                    />
                    <Button type="submit" size="sm" disabled={hideSelected.isPending}>
                      <EyeOff className="size-4" />
                      {hideSelected.isPending ? "Hiding…" : "Hide"}
                    </Button>
                  </form>
                  {canEditBins ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setMoving(true)} data-testid="parts-bulk-move">
                      <MapPin className="size-4" />
                      Move Bin
                    </Button>
                  ) : null}
                  {canEditClass ? <SetClassPicker ids={selected} onDone={donePicking} /> : null}
                </>
              )}
            </div>
          ) : null}

          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card" data-testid="parts-list">
            {rows.map((r) => (
              <PartRowView
                key={r.id}
                row={r}
                canEditMpn={!!page.data?.canEditMpn}
                canEditBins={canEditBins}
                canEditClass={canEditClass}
                canHide={canHide}
                canRemove={canRemove}
                showHidden={showHidden}
                selected={selected.includes(r.id)}
                onToggle={toggle}
                onChanged={refresh}
                onOpen={openPart}
                usage={usage.data?.[r.id]}
                usageLoading={usage.data?.[r.id] === undefined && usage.isFetching}
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
        </>
      )}

      <PartWindow
        id={search.part ?? null}
        initial={rows.find((r) => r.id === search.part)}
        canEditMpn={!!page.data?.canEditMpn}
        canEditBins={canEditBins}
        canEditClass={canEditClass}
        onClose={closePart}
        onChanged={refresh}
        onOpen={openPart}
      />
      {canEditBins ? (
        <MoveBinsDialog open={moving} ids={selected} parts={rows.filter((r) => picked.has(r.id))} onClose={() => setMoving(false)} onMoved={donePicking} />
      ) : null}
    </div>
  );
}

function PartRowView({
  row,
  canEditMpn,
  canEditBins,
  canEditClass,
  canHide,
  canRemove,
  showHidden,
  selected,
  onToggle,
  onChanged,
  onOpen,
  usage,
  usageLoading,
}: {
  row: PartRow;
  canEditMpn: boolean;
  /** Move Bin / Set Bin on the row: Admin only for now. */
  canEditBins: boolean;
  /** The Class as a pick list on the row: Admin only for now. */
  canEditClass: boolean;
  canHide: boolean;
  canRemove: boolean;
  showHidden: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
  onChanged: () => void;
  /** Opens the part's window. */
  onOpen: (id: number) => void;
  /** Tickets and pieces, all time; undefined until read. */
  usage: UsageTotals | undefined;
  usageLoading: boolean;
}) {
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [removeNote, setRemoveNote] = useState<string | null>(null);
  const photo = usePartPhoto(row, onChanged);
  const mpn = usePartMpnEdit(row, onChanged);
  const name = usePartNameEdit(row, onChanged);
  const binEdit = usePartBinEdit(row, onChanged);
  const cls = usePartClassEdit(row, onChanged);
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
          {canEditClass ? (
            <span className="flex items-center gap-1.5 text-muted-foreground" data-testid="part-class">
              <span className="font-medium tracking-wide uppercase">Class</span>
              <PartClassSelect row={row} edit={cls} className="h-7 px-1.5 text-xs" />
            </span>
          ) : row.itemClass ? (
            <span className="text-muted-foreground" data-testid="part-class">
              <span className="font-medium tracking-wide uppercase">Class</span> {row.itemClass}
            </span>
          ) : null}
          {bin ? (
            <span className="text-muted-foreground" data-testid="part-bin">
              <span className="font-medium tracking-wide uppercase">Bin</span> {bin}
            </span>
          ) : null}
          {row.previousNumbers.length ? (
            <span className="text-muted-foreground" data-testid="part-previously">
              <span className="font-medium tracking-wide uppercase">Was</span> {row.previousNumbers.join(", ")}
            </span>
          ) : null}
          <PartUsageLine totals={usage} loading={usageLoading} />
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
            {row.mergedInto ? (
              <>
                {" · "}
                <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => onOpen(row.mergedInto!.id)} data-testid="part-merged-into">
                  Merged into {row.mergedInto.sku}
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        <PartMpnForm row={row} edit={mpn} />
        <PartBinForm edit={binEdit} />

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
          {canEditBins ? <PartBinMoveButton row={row} edit={binEdit} /> : null}
          {canHide && showHidden && !row.mergedInto ? (
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
