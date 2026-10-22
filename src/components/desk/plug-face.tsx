/** Plug images for the Plug cell. The list of codes we have a picture for lives in plug-faces.ts. */
import { hasPlugFace, plugImageSrc } from "@/lib/ops/plug-faces";

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
