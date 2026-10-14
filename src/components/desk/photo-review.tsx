import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { setPartImage, type PartRow } from "@/lib/ops/parts-api";
import { treatResearchedPhoto } from "@/lib/part-photo-treatment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Confirm Photo: the photos research found for this part number that did not agree on three sources. A person looks
 * at each next to its source page and picks one (it gets the standard treatment) or none (the flag stays).
 */
export function PhotoReview({ part, onClose, onSaved }: { part: PartRow; onClose: () => void; onSaved: () => void }) {
  const candidates = part.research?.candidates ?? [];
  const [busy, setBusy] = useState<number | null>(null);
  const [broken, setBroken] = useState<number[]>([]);
  async function use(i: number) {
    setBusy(i);
    try {
      const base64 = await treatResearchedPhoto(part.id, i);
      await setPartImage({ data: { id: part.id, base64, sourceUrl: candidates[i]!.imageUrl } });
      toast.success("Photo confirmed and attached");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get that photo");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="photo-review">
        <DialogTitle>Confirm Photo</DialogTitle>
        <DialogDescription>
          Part # {part.mpn ?? part.sku}
          {part.description ? ` · ${part.description}` : ""}. Use a photo only if it is this exact part number.
        </DialogDescription>
        {part.research?.reason ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground" data-testid="photo-review-reason">
            Not confirmed: {part.research.reason}
          </p>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="photo-review-candidates">
          {candidates.map((c, i) => (
            <li key={c.imageUrl} className="flex flex-col rounded-lg border border-border p-2" data-testid="photo-candidate">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-white">
                {broken.includes(i) ? (
                  <p className="px-3 text-center text-xs text-muted-foreground">The source did not send this photo. Open the source page to see it.</p>
                ) : (
                  <img
                    src={`/api/part-photo-source/${part.id}?i=${i}`}
                    alt={`Candidate photo from ${c.site ?? "a source"}`}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                    onError={() => setBroken((b) => [...b, i])}
                  />
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{c.site ?? "Source"}</p>
              <p className="text-xs text-muted-foreground">{c.mpnShown ? `Shows: ${c.mpnShown}` : "Part number not shown"}</p>
              {c.watermark ? (
                <Badge size="tight" variant="warn" className="mt-1 w-fit">
                  Watermarked
                </Badge>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {c.pageUrl ? (
                  <a href={c.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-copper hover:underline">
                    Source page
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
                <a href={c.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                  Photo address
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <Button type="button" size="sm" className="mt-2" disabled={busy != null || !!c.watermark} onClick={() => void use(i)} data-testid="photo-candidate-use">
                {busy === i ? "Attaching…" : c.watermark ? "Watermarked: not used" : "Use This Photo"}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose} data-testid="photo-review-none">
            None Of These
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
