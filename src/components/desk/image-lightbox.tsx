import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState } from "react";
import { Download, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Click or tap an image to see it large. Close with the Close button, Esc, or a tap outside the picture.
 * Wraps the thumbnail in a button so it works with keyboard and touch. With `onOpen`, a click on the picture calls
 * it instead (the Parts row opens the part's window) and only the magnifier in the corner enlarges it.
 */
export function ZoomableImage({
  src,
  alt,
  label,
  className,
  imgClassName,
  testId,
  download,
  onOpen,
  openLabel,
}: {
  src: string;
  alt: string;
  /** Caption shown under the enlarged image. */
  label?: string;
  className?: string;
  imgClassName?: string;
  testId?: string;
  /** File name to save as; adds a Download button to the enlarged view. */
  download?: string;
  /** Click on the picture does this; the corner magnifier still enlarges it. */
  onOpen?: () => void;
  /** Read out for the picture when it opens something. */
  openLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {onOpen ? (
        <div className={cn("group relative block w-full", className)} data-testid={testId}>
          <button
            type="button"
            className="block size-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            aria-label={openLabel ?? alt}
            onClick={onOpen}
            data-testid={testId ? `${testId}-open` : undefined}
          >
            <img src={src} alt={alt} className={imgClassName} />
          </button>
          <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              className="absolute right-2 bottom-2 grid size-7 cursor-zoom-in place-items-center rounded-full bg-ink/70 text-cream opacity-80 transition-opacity group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Enlarge ${alt}`}
              data-testid={testId ? `${testId}-zoom` : undefined}
            >
              <ZoomIn className="size-4" />
            </button>
          </DialogPrimitive.Trigger>
        </div>
      ) : (
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn("group relative block w-full cursor-zoom-in focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", className)}
            aria-label={`Enlarge ${alt}`}
            data-testid={testId}
          >
            <img src={src} alt={alt} className={imgClassName} />
            <span className="pointer-events-none absolute right-2 bottom-2 grid size-7 place-items-center rounded-full bg-ink/70 text-cream opacity-80 transition-opacity group-hover:opacity-100">
              <ZoomIn className="size-4" />
            </span>
          </button>
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/85 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center p-3 focus:outline-none sm:p-8"
          data-testid="lightbox"
          aria-describedby={undefined}
          // The content covers the screen, so a click on the dark area around the picture closes it.
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(100dvh-7rem)] max-w-full rounded-lg bg-white object-contain shadow-2xl"
            data-testid="lightbox-image"
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {label ? <span className="text-sm text-white/85">{label}</span> : null}
            {download ? (
              <a
                href={src}
                download={download}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-white/90"
                data-testid="lightbox-download"
              >
                <Download className="size-4" /> Download
              </a>
            ) : null}
            <DialogPrimitive.Close
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-white/90"
              data-testid="lightbox-close"
            >
              <X className="size-4" /> Close
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
