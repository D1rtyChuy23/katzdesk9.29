/**
 * Plug images for the Plug cell, cut from the provided NEMA configurations chart
 * (public/nema/<code>P.png). Only codes we have a real image for get one — no generated art,
 * and a 120 V plug never borrows the L6 twist-lock image.
 */
const NEMA_IMAGES = new Set([
  "5-15",
  "5-20",
  "6-20",
  "6-30",
  "6-50",
  "14-20",
  "14-30",
  "L5-15",
  "L5-20",
  "L6-20",
  "L6-30",
  "L14-20",
  "L14-30",
]);

export function hasPlugFace(nema: string | null | undefined): boolean {
  return !!nema && NEMA_IMAGES.has(nema);
}

export function plugImageSrc(nema: string): string {
  return `/nema/${nema}P.png`;
}

/** Image + NEMA label for the Plug cell. Nothing for hardwire or a code we have no image for. */
export function PlugPicture({ nema, label, note }: { nema: string; label: string; note?: string | null }) {
  if (!hasPlugFace(nema)) return null;
  return (
    <figure className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5" data-testid="plug-image" data-nema={nema}>
      <img
        src={plugImageSrc(nema)}
        alt={`${label} plug face`}
        width={240}
        height={240}
        loading="lazy"
        className="size-24 shrink-0 rounded-md border border-border bg-white object-contain p-1"
      />
      <figcaption className="min-w-0 text-sm">
        <span className="block font-semibold" data-testid="plug-label">
          {label}
        </span>
        {note ? <span className="mt-0.5 block text-xs text-warning">{note}</span> : null}
      </figcaption>
    </figure>
  );
}
