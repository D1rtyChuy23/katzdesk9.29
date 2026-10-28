import { useMutation } from "@tanstack/react-query";
import { Camera, MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setPartGetLater, type PartRow } from "@/lib/ops/parts-api";
import { BIN_LABEL, BIN_MAX, BIN_PIECES } from "@/lib/ops/part-bins";
import { PART_CLASSES, isPartClass } from "@/lib/ops/part-pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PhotoReview } from "./photo-review";
import type { PartBinEdit, PartClassEdit, PartMpnEdit, PartNameEdit, PartPhoto } from "./part-edits";

/*
 * The part edits shared by a row on Parts and the part's window: Get Later, the photo actions, the MPN, the part
 * name, the bin location and the class. One version of each, so the row and the window always behave the same. Test
 * ids are `<tid>-…`: the row keeps its own `part-…` ids and the window uses `part-window-…`. The state behind them is
 * in part-edits.ts.
 */

type Changed = () => void;

/** Get Later: a mark to pull the part later. Anyone on the Desk. */
export function PartGetLater({ row, onChanged, tid = "part" }: { row: PartRow; onChanged: Changed; tid?: string }) {
  const later = useMutation({
    mutationFn: (on: boolean) => setPartGetLater({ data: { id: row.id, on } }),
    onSuccess: (_r, on) => {
      toast.success(on ? "Marked Get Later" : "Get Later cleared");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change Get Later"),
  });
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium" title="Marks the part to pull later. Price and stock do not change." data-testid={`${tid}-get-later`}>
      <input type="checkbox" className="size-4 accent-primary" checked={row.getLater} disabled={later.isPending} onChange={(e) => later.mutate(e.target.checked)} />
      Get Later
    </label>
  );
}

// ------------------------------------------------------------------------------------------ photo

/** Photo Confirmed / Confirm Photo, and Pull Confirmed Photo or Review Photos when research found some. */
export function PartPhotoStatus({ row, photo, tid = "part" }: { row: PartRow; photo: PartPhoto; tid?: string }) {
  return (
    <>
      {row.hasImage && row.photoStatus === "confirmed" ? (
        <Badge size="tight" variant="success" title={row.photoSourceUrl ? `From ${row.photoSourceUrl}` : row.photoConfirmedBy ? `Added by ${row.photoConfirmedBy}` : undefined} data-testid={`${tid}-photo-confirmed`}>
          Photo Confirmed
        </Badge>
      ) : !row.hasImage ? (
        <Badge size="tight" variant="warn" title={row.research?.reason ?? "No photo has been confirmed for this part number yet."} data-testid={`${tid}-confirm-photo`}>
          Confirm Photo
        </Badge>
      ) : null}
      {!row.hasImage && row.research?.verdict === "confirmed" && row.research.imageUrl ? (
        <Button type="button" size="sm" variant="outline" className="h-7" disabled={photo.pull.isPending} onClick={() => photo.pull.mutate()} data-testid={`${tid}-pull-confirmed`}>
          {photo.pull.isPending ? "Pulling…" : "Pull Confirmed Photo"}
        </Button>
      ) : null}
      {!row.hasImage && row.research?.verdict === "review" && row.research.candidates.length ? (
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => photo.setReviewing(true)} data-testid={`${tid}-review-photos`}>
          Review Photos ({row.research.candidates.length})
        </Button>
      ) : null}
    </>
  );
}

/** The Confirm Photo window, while Review Photos is open. */
export function PartPhotoReview({ row, photo, onChanged }: { row: PartRow; photo: PartPhoto; onChanged: Changed }) {
  return photo.reviewing ? <PhotoReview part={row} onClose={() => photo.setReviewing(false)} onSaved={onChanged} /> : null;
}

/** Add Photo / Replace Photo and Remove. Pair with PartPhotoFile, the file picker they open. */
export function PartPhotoButtons({ row, photo, tid = "part" }: { row: PartRow; photo: PartPhoto; tid?: string }) {
  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={photo.upload.isPending} onClick={() => photo.fileRef.current?.click()} data-testid={`${tid}-photo-add`}>
        <Camera className="size-4" />
        {photo.upload.isPending ? "Saving…" : row.hasImage ? "Replace Photo" : "Add Photo"}
      </Button>
      {row.hasImage ? (
        <Button type="button" size="sm" variant="ghost" disabled={photo.remove.isPending} onClick={() => photo.remove.mutate()} data-testid={`${tid}-photo-remove`}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      ) : null}
    </>
  );
}

export function PartPhotoFile({ photo, tid = "part" }: { photo: PartPhoto; tid?: string }) {
  return (
    <input
      ref={photo.fileRef}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      data-testid={`${tid}-photo-file`}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) photo.upload.mutate(f);
      }}
    />
  );
}

// ------------------------------------------------------------------------------------------ MPN

export function PartMpnForm({ row, edit, tid = "part", className = "mt-2" }: { row: PartRow; edit: PartMpnEdit; tid?: string; className?: string }) {
  if (!edit.editing) return null;
  return (
    <form
      className={cn("flex flex-wrap items-center gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        edit.save.mutate();
      }}
      data-testid={`${tid}-mpn-form`}
    >
      <Input
        value={edit.value}
        onChange={(e) => edit.setValue(e.target.value)}
        aria-label={`MPN for ${row.item}`}
        placeholder="Manufacturer part number"
        className="h-9 w-56"
        autoFocus
        data-testid={`${tid}-mpn-input`}
      />
      <Button type="submit" size="sm" disabled={edit.save.isPending} data-testid={`${tid}-mpn-save`}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => edit.setEditing(false)}>
        Cancel
      </Button>
    </form>
  );
}

export function PartMpnEditButton({ row, edit, tid = "part" }: { row: PartRow; edit: PartMpnEdit; tid?: string }) {
  if (edit.editing) return null;
  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => edit.setEditing(true)} data-testid={`${tid}-mpn-edit`}>
      <Pencil className="size-4" />
      {row.mpn ? "Edit MPN" : "Set MPN"}
    </Button>
  );
}

// ------------------------------------------------------------------------------------------ part name

export function PartNameForm({ row, edit, tid = "part", className = "mt-2" }: { row: PartRow; edit: PartNameEdit; tid?: string; className?: string }) {
  if (!edit.editing) return null;
  return (
    <form
      className={cn("flex flex-wrap items-center gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        edit.save.mutate();
      }}
      data-testid={`${tid}-description-form`}
    >
      <Input
        value={edit.value}
        onChange={(e) => edit.setValue(e.target.value)}
        aria-label={`Description for ${row.item}`}
        placeholder="What this part is"
        maxLength={500}
        className="h-9 w-full sm:w-96"
        autoFocus
        data-testid={`${tid}-description-input`}
      />
      <Button type="submit" size="sm" disabled={edit.save.isPending} data-testid={`${tid}-description-save`}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={edit.cancel}>
        Cancel
      </Button>
    </form>
  );
}

export function PartNameEditButton({ row, edit, tid = "part" }: { row: PartRow; edit: PartNameEdit; tid?: string }) {
  if (edit.editing) return null;
  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => edit.setEditing(true)} data-testid={`${tid}-description-edit`}>
      <Pencil className="size-4" />
      {row.description ? "Edit Part Name" : "Add Part Name"}
    </Button>
  );
}

// ------------------------------------------------------------------------------------------ bin location

/** Rack, Shelf and Bin boxes side by side (three across on a phone too: the pieces are short). */
export function PartBinFields({ edit, tid = "part", autoFocus = false }: { edit: PartBinEdit; tid?: string; autoFocus?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BIN_PIECES.map((k, i) => (
        <label key={k} className="min-w-0 text-xs font-medium text-muted-foreground">
          {BIN_LABEL[k]}
          <Input
            value={edit.draft[k]}
            onChange={(e) => edit.setPiece(k, e.target.value)}
            maxLength={BIN_MAX}
            autoComplete="off"
            autoFocus={autoFocus && i === 0}
            className="mt-1 h-9 font-normal"
            data-testid={`${tid}-bin-${k}`}
          />
        </label>
      ))}
    </div>
  );
}

/** Move Bin on a row: the boxes open under the part with its bin now. Save writes all three; Esc cancels. */
export function PartBinForm({ edit, tid = "part", className = "mt-2" }: { edit: PartBinEdit; tid?: string; className?: string }) {
  if (!edit.editing) return null;
  return (
    <form
      className={cn("max-w-md", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (edit.dirty) edit.save.mutate();
        else edit.cancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") edit.cancel();
      }}
      data-testid={`${tid}-bin-form`}
    >
      <PartBinFields edit={edit} tid={tid} autoFocus />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!edit.dirty || edit.save.isPending} data-testid={`${tid}-bin-save`}>
          {edit.save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={edit.cancel}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">A blank box clears that piece.</span>
      </div>
    </form>
  );
}

export function PartBinMoveButton({ row, edit, tid = "part" }: { row: PartRow; edit: PartBinEdit; tid?: string }) {
  if (edit.editing) return null;
  const has = !!(row.binRack || row.binShelf || row.binBin);
  return (
    <Button type="button" size="sm" variant="ghost" onClick={() => edit.setEditing(true)} data-testid={`${tid}-bin-edit`}>
      <MapPin className="size-4" />
      {has ? "Move Bin" : "Set Bin"}
    </Button>
  );
}

// ------------------------------------------------------------------------------------------ class

/**
 * The Class as a pick list of the five; picking one saves it. A class from before the five were set (or from a file)
 * is shown as it is until another is picked.
 */
export function PartClassSelect({ row, edit, tid = "part", className }: { row: PartRow; edit: PartClassEdit; tid?: string; className?: string }) {
  const odd = edit.value && !isPartClass(edit.value) ? edit.value : null;
  return (
    <select
      value={edit.value}
      onChange={(e) => edit.pick(e.target.value)}
      disabled={edit.save.isPending}
      aria-label={`Class for ${row.item}`}
      className={cn(
        "h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
        className,
      )}
      data-testid={`${tid}-class-select`}
    >
      <option value="">No class</option>
      {odd ? (
        <option value={odd} disabled>
          {odd}
        </option>
      ) : null}
      {PART_CLASSES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
