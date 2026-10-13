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
 * they always show the same photo.
 */
export function PartThumb({
  part,
  name,
  size = "md",
  className,
}: {
  part: PartThumbRef | null | undefined;
  /** The part's name, for the enlarged view and for screen readers. */
  name: string;
  size?: keyof typeof SIZE;
  className?: string;
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
      />
    );
  }
  const label = slotLabel({ mpn: part?.mpn, sku: part?.sku });
  return (
    <div
      role="img"
      aria-label={`No photo yet for ${name}. ${label.main}`}
      className={cn(
        box,
        "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border bg-muted/40 p-1 text-center",
        className,
      )}
      data-testid="part-slot"
    >
      <ImageOff className="size-4 text-muted-foreground" aria-hidden />
      <span className="max-w-full text-[10px] leading-tight font-medium break-all text-foreground" data-testid="part-slot-label">
        {label.main}
      </span>
      {size !== "sm" && label.sub ? <span className="max-w-full text-[9px] leading-tight break-all text-muted-foreground">{label.sub}</span> : null}
    </div>
  );
}
