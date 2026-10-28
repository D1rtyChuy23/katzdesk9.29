import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPart, type PartRow } from "@/lib/ops/parts-api";
import { binText } from "@/lib/ops/part-bins";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/separator";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PartThumb } from "./part-thumb";
import {
  PartBinFields,
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
} from "./part-controls";
import { partMoney, usePartBinEdit, usePartClassEdit, usePartMpnEdit, usePartNameEdit, usePartPhoto } from "./part-edits";
import { PartUsageSection } from "./part-usage";

const T = "part-window";
const heading = "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase";

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The part's own window on Parts. The NetSuite Description (the part's name) is the title; under it the part
 * number, then the details, the photo and its actions, Get Later, the bin location (Rack, Shelf, Bin), and its usage:
 * every ticket that used it, counted by month, quarter or year.
 * `initial` is the row already on the list, shown at once while the part loads. The bin and the Class are changed
 * here by an Admin (canEditBins, canEditClass); everyone else sees them.
 */
export function PartWindow({
  id,
  initial,
  canEditMpn,
  canEditBins,
  canEditClass,
  onClose,
  onChanged,
  onOpen,
}: {
  id: number | null;
  initial?: PartRow | null;
  canEditMpn: boolean;
  canEditBins: boolean;
  canEditClass: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Opens another part's window: the one a merged part went into. */
  onOpen?: (id: number) => void;
}) {
  // Keep the last part while the window slides closed, so it does not flash empty.
  const [shown, setShown] = useState<number | null>(id);
  useEffect(() => {
    if (id != null) setShown(id);
  }, [id]);
  const part = useQuery({
    queryKey: ["parts", "one", shown],
    queryFn: () => getPart({ data: { id: shown! } }),
    enabled: shown != null,
    initialData: initial && initial.id === shown ? initial : undefined,
  });
  const row = part.data;
  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined} data-testid="part-window">
        {row ? (
          <PartWindowView key={row.id} row={row} canEditMpn={canEditMpn} canEditBins={canEditBins} canEditClass={canEditClass} onChanged={onChanged} onOpen={onOpen} />
        ) : (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Part</p>
              <SheetTitle>{part.isLoading ? "Loading…" : "Part not found"}</SheetTitle>
            </SheetHeader>
            <SheetBody>
              {part.isLoading ? (
                <div className="p-5">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="mt-3 h-40 w-full" />
                </div>
              ) : (
                <p className="p-5 text-sm text-muted-foreground" data-testid="part-window-missing">
                  {part.isError ? (part.error instanceof Error ? part.error.message : "Could not load this part.") : "That part is no longer on the list."}
                </p>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PartWindowView({
  row,
  canEditMpn,
  canEditBins,
  canEditClass,
  onChanged,
  onOpen,
}: {
  row: PartRow;
  canEditMpn: boolean;
  canEditBins: boolean;
  canEditClass: boolean;
  onChanged: () => void;
  onOpen?: (id: number) => void;
}) {
  const photo = usePartPhoto(row, onChanged);
  const mpn = usePartMpnEdit(row, onChanged);
  const name = usePartNameEdit(row, onChanged);
  const cls = usePartClassEdit(row, onChanged);
  const number = row.mpn ?? row.sku;
  return (
    <>
      <SheetHeader>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{row.hiddenAt ? "Part · Hidden" : "Part"}</p>
        {/* The NetSuite Description is the part's name. None stored: say so, never fill one in. */}
        {row.description ? (
          <SheetTitle className="break-words max-sm:text-lg max-sm:leading-snug" data-testid="part-window-title">
            {row.description}
          </SheetTitle>
        ) : (
          <SheetTitle className="text-base font-normal text-muted-foreground" data-testid="part-window-title" data-blank="true">
            No NetSuite description
          </SheetTitle>
        )}
        <p className="mt-0.5 text-sm break-words text-muted-foreground" data-testid="part-window-number">
          Part # <span className="font-medium text-foreground">{number}</span>
        </p>
        {/* A row folded into another part (an import copy, or an old number): it stays hidden; that part is the one used. */}
        {row.mergedInto ? (
          <p className="mt-1 text-sm" data-testid="part-window-merged-into">
            Merged into{" "}
            {onOpen ? (
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => onOpen(row.mergedInto!.id)}>
                {row.mergedInto.sku}
              </button>
            ) : (
              <span className="font-medium">{row.mergedInto.sku}</span>
            )}
            . Its uses, PM machine parts and searches go to that part.
          </p>
        ) : null}
        {canEditMpn && !name.editing ? (
          <div className="mt-1 -ml-3">
            <PartNameEditButton row={row} edit={name} tid={T} />
          </div>
        ) : null}
        <PartNameForm row={row} edit={name} tid={T} />
      </SheetHeader>
      <SheetBody>
        <section className="border-b border-border p-5" data-testid="part-window-details">
          <h3 className={heading}>Details</h3>
          <dl className="mt-3 grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Part # (MPN)</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-1" data-testid="part-window-mpn">
              {row.mpn ? <span className="font-medium break-all">{row.mpn}</span> : <span className="text-muted-foreground">not set</span>}
              {canEditMpn ? (
                <span className="-my-1.5">
                  <PartMpnEditButton row={row} edit={mpn} tid={T} />
                </span>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">NetSuite Item</dt>
            <dd className="min-w-0 break-all" data-testid="part-window-item">
              {row.item}
            </dd>
            {row.item !== row.sku ? (
              <>
                <dt className="text-muted-foreground">SKU</dt>
                <dd className="min-w-0 break-all" data-testid="part-window-sku">
                  {row.sku}
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Class</dt>
            <dd data-testid="part-window-class">
              {canEditClass ? (
                <PartClassSelect row={row} edit={cls} tid={T} className="-my-1 w-full max-w-56" />
              ) : (
                (row.itemClass ?? <span className="text-muted-foreground">Not set</span>)
              )}
            </dd>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="tabular" data-testid="part-window-price">
              {row.rate != null ? partMoney(row.rate) : <span className="text-muted-foreground">Not set</span>}
            </dd>
            <dt className="text-muted-foreground">Mfr List Price</dt>
            <dd className="tabular" data-testid="part-window-list-price">
              {row.listPrice != null ? partMoney(row.listPrice) : <span className="text-muted-foreground">Not set</span>}
            </dd>
            <dt className="text-muted-foreground">Get Later</dt>
            <dd>
              <PartGetLater row={row} onChanged={onChanged} tid={T} />
            </dd>
            {row.previousNumbers.length ? (
              <>
                <dt className="text-muted-foreground">Previously</dt>
                <dd className="min-w-0 break-words" data-testid="part-window-previously">
                  {row.previousNumbers.join(", ")}
                </dd>
              </>
            ) : null}
            {row.mergeNote ? (
              <>
                <dt className="text-muted-foreground">Note</dt>
                <dd className="min-w-0 break-words whitespace-pre-line" data-testid="part-window-note">
                  {row.mergeNote}
                </dd>
              </>
            ) : null}
          </dl>
          <PartMpnForm row={row} edit={mpn} tid={T} className="mt-3" />
        </section>

        <section className="border-b border-border p-5" data-testid="part-window-photo">
          <h3 className={heading}>Photo</h3>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
            <PartThumb
              part={{ id: row.id, sku: row.sku, mpn: row.mpn, hasImage: row.hasImage, imageVersion: row.imageVersion }}
              name={row.description || row.item}
              size="lg"
              className="size-40 sm:size-44"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <PartPhotoStatus row={row} photo={photo} tid={T} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PartPhotoButtons row={row} photo={photo} tid={T} />
                <PartPhotoFile photo={photo} tid={T} />
              </div>
            </div>
          </div>
          <PartPhotoReview row={row} photo={photo} onChanged={onChanged} />
        </section>

        <BinSection row={row} canEdit={canEditBins} onChanged={onChanged} />

        <PartUsageSection partId={row.id} />
      </SheetBody>
    </>
  );
}

/** Rack, Shelf and Bin. An Admin changes them (Admin only for now, Chuy 10/28); everyone sees them. */
function BinSection({ row, canEdit, onChanged }: { row: PartRow; canEdit: boolean; onChanged: () => void }) {
  const edit = usePartBinEdit(row, onChanged);
  const stored = { rack: row.binRack, shelf: row.binShelf, bin: row.binBin };
  const changed = row.binUpdatedAt ? `Changed by ${row.binUpdatedBy || "Desk"} on ${shortDate(row.binUpdatedAt)}` : null;
  return (
    <section className="p-5" data-testid="part-window-bin">
      <h3 className={heading}>Bin Location</h3>
      {canEdit ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (edit.dirty) edit.save.mutate();
          }}
        >
          <PartBinFields edit={edit} tid={T} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!edit.dirty || edit.save.isPending} data-testid={`${T}-bin-save`}>
              {edit.save.isPending ? "Saving…" : "Save"}
            </Button>
            {edit.dirty ? (
              <Button type="button" size="sm" variant="ghost" onClick={edit.cancel}>
                Cancel
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground" data-testid={`${T}-bin-changed`}>
              {changed ?? "A blank box clears that piece."}
            </span>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-3 text-sm" data-testid={`${T}-bin-text`}>
            {binText(stored) ?? <span className="text-muted-foreground">Not set</span>}
          </p>
          {changed ? <p className="mt-1 text-xs text-muted-foreground">{changed}</p> : null}
        </>
      )}
    </section>
  );
}
