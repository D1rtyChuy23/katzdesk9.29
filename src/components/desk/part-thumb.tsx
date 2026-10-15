import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { partImageUrl, slotLabel } from "@/lib/ops/part-images";
import { ZoomableImage } from "./image-lightbox";

export type PartThumbRef = {
  id: number;
  sku?: string | null;
  mpn: string | null;
  hasImage: boolean;
  imageVersion: string | null;
};

const SIZE = { sm: "size-12", md: "size-16", lg: "size-24 sm:size-28" } as const;

/**
 * A part's photo. Click or tap enlarges it. With no photo stored it is a blank slot labeled with the MPN:
 * never another part's picture. The inventory list, the invoice picker and the invoice line all use this, so
 * they always show the same photo. With `onOpen` (the Parts row) a click opens the part instead; the magnifier in
 * the photo's corner still enlarges it.
 */
export function PartThumb({
  part,
  name,
  size = "md",
  className,
  onOpen,
}: {
  part: PartThumbRef | null | undefined;
  /** The part's name, for the enlarged view and for screen readers. */
  name: string;
  size?: keyof typeof SIZE;
  className?: string;
  /** Click opens the part (its window) instead of enlarging the photo. */
  onOpen?: () => void;
}) {
  const box = SIZE[size];
  if (part?.hasImage) {
    return (
      <ZoomableImage
        src={partImageUrl(part.id, part.imageVersion)}
        alt={`Photo of ${name}`}
        label={part.mpn ? `${name} · MPN ${part.mpn}` : name}
        className={cn(box, "shrink-0 overflow-hidden rounded-lg border border-border bg-white", className)}
        imgClassName="size-full object-contain"
        testId="part-photo"
        onOpen={onOpen}
        openLabel={onOpen ? `Open ${name}` : undefined}
      />
    );
  }
  const label = slotLabel({ mpn: part?.mpn, sku: part?.sku });
  const slotClass = cn(
    box,
    "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border bg-muted/40 p-1 text-center",
    onOpen ? "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" : null,
    className,
  );
  const inside = (
    <>
      <ImageOff className="size-4 text-muted-foreground" aria-hidden />
      {/* Phones: break at spaces and hyphens first ("SKU FETCO-1252-" / "SPRAY"), mid-word only when nothing else fits. */}
      <span className="max-w-full text-[10px] leading-tight font-medium break-all text-foreground max-sm:[overflow-wrap:anywhere] max-sm:[word-break:normal]" data-testid="part-slot-label">
        {label.main}
      </span>
      {size !== "sm" && label.sub ? (
        <span className="max-w-full text-[9px] leading-tight break-all text-muted-foreground max-sm:[overflow-wrap:anywhere] max-sm:[word-break:normal]">{label.sub}</span>
      ) : null}
    </>
  );
  if (onOpen) {
    return (
      <button type="button" aria-label={`Open ${name}. No photo yet. ${label.main}`} className={slotClass} onClick={onOpen} data-testid="part-slot">
        {inside}
      </button>
    );
  }
  return (
    <div role="img" aria-label={`No photo yet for ${name}. ${label.main}`} className={slotClass} data-testid="part-slot">
      {inside}
    </div>
  );
}
