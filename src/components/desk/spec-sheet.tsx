import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, Droplets, ImageIcon, Pencil, Plug, RefreshCw, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { amps, copyAll, copyConfig, CORE_HOLE_NOTE, hz, phase, volts } from "@/lib/ops/spec-copy";
import type { Requirements, SavedSpecSheet, SpecConfig, SpecSheetDraft } from "@/lib/ops/spec-schema";
import { coreHoleInfo, defaultPlugNote, nemaCode, type CoreHoleInfo, type PlugContext } from "@/lib/ops/spec-defaults";
import { getSpecImage } from "@/lib/ops/spec-library";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PlugPicture } from "./plug-face";
import { ZoomableImage } from "./image-lightbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------- copy with fallback ----------------

/** Clipboard API first; if the browser blocks it, the caller shows a select-and-copy box. */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* blocked: fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy(key: string, text: string) {
    const ok = await writeClipboard(text);
    if (!ok) {
      setManual(text);
      return;
    }
    setCopied(key);
    toast.success("Copied");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  }
  const dialog = <ManualCopyDialog text={manual} onClose={() => setManual(null)} />;
  return { copy, copied, dialog };
}

function ManualCopyDialog({ text, onClose }: { text: string | null; onClose: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (text) window.setTimeout(() => ref.current?.select(), 50);
  }, [text]);
  return (
    <Dialog open={!!text} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="manual-copy">
        <DialogTitle>Copy The Text</DialogTitle>
        <DialogDescription>This browser blocked the copy button. The text is selected — press Ctrl+C (⌘C on Mac).</DialogDescription>
        <textarea
          ref={ref}
          readOnly
          value={text ?? ""}
          rows={Math.min(14, (text ?? "").split("\n").length + 1)}
          className="mt-3 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" className="mt-3" onClick={onClose}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- building blocks shared with the review form ----------------

export function ConfigChips({
  configs,
  selected,
  onSelect,
  trailing,
}: {
  configs: { label: string }[];
  selected: number;
  onSelect: (i: number) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Configurations" data-testid="config-chips">
      {configs.map((c, i) => (
        <button
          key={`${c.label}-${i}`}
          type="button"
          role="radio"
          aria-checked={selected === i}
          onClick={() => onSelect(i)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            selected === i
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          {c.label || `Configuration ${i + 1}`}
        </button>
      ))}
      {trailing}
    </div>
  );
}

const POWER_FIELDS = [
  ["voltage", "Voltage"],
  ["wires", "Wires"],
  ["amps", "Amps"],
  ["breaker", "Breaker"],
  ["phase", "Phase"],
  ["hz", "Hz"],
  ["plug", "Plug"],
  ["circuit", "Circuit"],
] as const;
const WATER_FIELDS = [
  ["inlet", "Inlet"],
  ["pressure", "Pressure"],
  ["filtration", "Filtration"],
  ["notes", "Notes"],
] as const;
const DRAIN_FIELDS = [
  ["size", "Drain"],
  ["notes", "Drain Notes"],
] as const;
const DIM_FIELDS = [
  ["width", "Width"],
  ["depth", "Depth"],
  ["height", "Height"],
  ["weight", "Weight"],
  ["clearance", "Clearance"],
] as const;
export const REQUIREMENT_GROUPS = { POWER_FIELDS, WATER_FIELDS, DRAIN_FIELDS, DIM_FIELDS };

function Rows({ rows }: { rows: [string, string | undefined][] }) {
  const shown = rows.filter(([, v]) => v && v.trim());
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ icon: Icon, title, children }: { icon: typeof Plug; title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        <Icon className="size-3.5 text-copper" />
        {title}
      </h4>
      {children}
    </div>
  );
}

/** Power / Water And Drain / Dimensions for one configuration. Empty sections are hidden. */
export function RequirementsCard({ req, core, ctx }: { req: Requirements; core?: CoreHoleInfo | null; ctx?: PlugContext }) {
  // Same units as the copy text: 30 → 30A, 1 → 1-phase, 60 → 60 Hz.
  const fmt: Record<string, (v: string) => string> = { voltage: volts, amps, phase, hz };
  const power = POWER_FIELDS.map(([k, l]) => {
    const v = req.power?.[k];
    return [l, v && fmt[k] ? fmt[k](v) : v] as [string, string | undefined];
  });
  const water = [
    ...WATER_FIELDS.map(([k, l]) => [l, req.water?.[k]] as [string, string | undefined]),
    ...DRAIN_FIELDS.map(([k, l]) => [l, req.drain?.[k]] as [string, string | undefined]),
  ];
  const dims = DIM_FIELDS.map(([k, l]) => [l, req.dimensions?.[k]] as [string, string | undefined]);
  const other = (req.other ?? []).map((o) => [o.label, o.value] as [string, string]);
  const any = (rows: [string, string | undefined][]) => rows.some(([, v]) => v && v.trim());
  const sections = [
    any(power) ? (
      <Block key="p" icon={Plug} title="Power">
        <Rows rows={power} />
        <PlugSection power={req.power} ctx={ctx} />
      </Block>
    ) : null,
    any(water) ? <Block key="w" icon={Droplets} title="Water And Drain"><Rows rows={water} /></Block> : null,
    any(dims) || core ? (
      <Block key="d" icon={Ruler} title="Space / Core Hole">
        <Rows rows={dims} />
        <CoreHoleLine core={core} />
      </Block>
    ) : null,
    any(other) ? <Block key="o" icon={ClipboardCopy} title="Other"><Rows rows={other} /></Block> : null,
  ].filter(Boolean);
  if (!sections.length) return <p className="text-sm text-muted-foreground">No requirements listed for this configuration.</p>;
  return <div className="grid gap-3 sm:grid-cols-2" data-testid="requirements-card">{sections}</div>;
}

/** Core-hole status next to Space: Yes/No, the saved diameter, and the below-counter note. */
export function CoreHoleLine({ core }: { core?: CoreHoleInfo | null }) {
  if (!core) return null;
  return (
    <div
      className={cn(
        "mt-2 space-y-0.5 rounded-md border px-2.5 py-1.5 text-sm",
        core.missingDiameter ? "border-warning/50 bg-warning/10" : core.required ? "border-primary/30 bg-primary/5" : "border-border bg-background/60",
      )}
      data-testid="core-hole-line"
    >
      <p>
        <span className="text-muted-foreground">Utility lines pass through the counter: </span>
        <span className="font-semibold">{core.required ? "Yes" : "No"}</span>
      </p>
      {core.required ? (
        core.missingDiameter ? (
          <p className="font-semibold text-warning">Hole diameter needed before this spec is complete</p>
        ) : (
          <>
            <p>
              <span className="text-muted-foreground">Hole diameter: </span>
              <span className="font-semibold">{core.diameter}</span>
            </p>
          </>
        )
      ) : null}
      <p className="text-xs text-muted-foreground" data-testid="core-hole-note">
        {CORE_HOLE_NOTE}
      </p>
    </div>
  );
}

/** Equipment picture from the spec sheet, or a blank slot with the model name. No app branding in it. */
export function EquipmentImage({
  image,
  loading,
  manufacturer,
  model,
  className,
}: {
  image: string | null | undefined;
  loading?: boolean;
  manufacturer?: string;
  model: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-white",
        className,
      )}
      data-testid="equipment-image"
      data-empty={image ? "0" : "1"}
    >
      {image ? (
        <ZoomableImage
          src={image}
          alt={`${manufacturer ?? ""} ${model}`.trim()}
          label={`${manufacturer ?? ""} ${model}`.trim()}
          className="size-full"
          imgClassName="size-full object-contain p-2"
          testId="equipment-zoom"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 border-2 border-dashed border-border/70 bg-muted/30 p-4 text-center">
          <ImageIcon className="size-6 text-muted-foreground/70" />
          <span className="text-sm font-semibold text-foreground">{model || "Model"}</span>
          <span className="text-xs text-muted-foreground">{loading ? "Loading image…" : "No image on the spec sheet yet"}</span>
        </div>
      )}
    </div>
  );
}

/** Secondary image: the dimension drawing, under the machine photo. Hidden when the sheet has none. */
export function DimensionsImage({ image }: { image: string | null | undefined }) {
  if (!image) return null;
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-white" data-testid="dims-image">
      <ZoomableImage src={image} alt="Dimensions diagram" label="Dimensions" imgClassName="w-full object-contain p-2" testId="dims-zoom" />
      <figcaption className="border-t border-border bg-card px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Dimensions
      </figcaption>
    </figure>
  );
}

export function SheetHeading({ sheet }: { sheet: Pick<SpecSheetDraft, "manufacturer" | "model" | "category" | "summary"> }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-copper uppercase">
        {sheet.manufacturer}
        {sheet.category ? <span className="text-muted-foreground"> · {sheet.category}</span> : null}
      </p>
      <h2 className="mt-1 font-display text-3xl font-medium tracking-tight">{sheet.model}</h2>
      {sheet.summary ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{sheet.summary}</p> : null}
    </div>
  );
}

/** The plug picture under the Power rows: NEMA plugs only — hardwire gets none. */
export function PlugSection({ power, ctx }: { power: Requirements["power"]; ctx?: PlugContext }) {
  const plug = power?.plug?.trim();
  const note = defaultPlugNote(power, ctx);
  if (!plug) {
    // 220 V with no wire count: no plug, no image — just the flag.
    return note ? (
      <p className="mt-3 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-sm font-semibold text-warning" data-testid="plug-flag">
        {note}
      </p>
    ) : null;
  }
  const nema = nemaCode(plug);
  if (!nema) return null;
  return (
    <div className="mt-3">
      <PlugPicture nema={nema} label={plug} note={note} />
    </div>
  );
}

// ---------------- the saved machine page ----------------

export function SpecSheetView({
  sheet,
  canEdit,
  onEdit,
  onDelete,
  onRefresh,
  refreshing,
  onReread,
}: {
  sheet: SavedSpecSheet;
  canEdit: boolean;
  onEdit: () => void;
  /** Re-apply inlet / plug / breaker defaults (Admin and Sales). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Re-read the machine photo and dimensions diagram from the sheet's PDF (Admin and Sales). */
  onReread?: () => void;
  onDelete: () => void;
}) {
  const [sel, setSel] = useState(0);
  const { copy, copied, dialog } = useCopy();
  const imageQ = useQuery({
    queryKey: ["spec-image", sheet.id, sheet.updatedAt],
    queryFn: () => getSpecImage({ data: { id: sheet.id } }),
    enabled: sheet.hasImage || sheet.hasDims,
    staleTime: 5 * 60_000,
  });
  const core = coreHoleInfo(sheet);
  useEffect(() => setSel(0), [sheet.id]);
  const config: SpecConfig | undefined = sheet.configs[Math.min(sel, sheet.configs.length - 1)];
  const certs = sheet.mfrNotes.certifications ?? [];
  const hasNotes = certs.length || sheet.mfrNotes.warranty || sheet.mfrNotes.usContact;

  return (
    <article className="rounded-xl border border-border bg-card p-5 sm:p-6" data-testid="spec-sheet">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SheetHeading sheet={sheet} />
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {onRefresh ? (
              <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing} data-testid="spec-refresh">
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> Refresh Defaults
              </Button>
            ) : null}
            {onReread ? (
              <Button type="button" size="sm" variant="outline" onClick={onReread} data-testid="spec-reread">
                <ImageIcon className="size-3.5" /> Re-Read Image From PDF
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDelete} aria-label="Delete spec sheet">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {sheet.specs.length || hasNotes ? (
        <section className="mt-5 grid gap-3 lg:grid-cols-[2fr_1fr]">
          {sheet.specs.length ? (
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Specs</h3>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2" data-testid="spec-rows">
                {sheet.specs.map((s, i) => (
                  <div key={`${s.label}-${i}`} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{s.label}</dt>
                    <dd className="font-medium break-words">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          {hasNotes ? (
            <div className="rounded-lg border border-border bg-background/60 p-4 text-sm">
              <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Manufacturer (USA)</h3>
              {certs.length ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {certs.map((c) => (
                    <span key={c} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
              {sheet.mfrNotes.warranty ? (
                <p>
                  <span className="text-muted-foreground">Warranty: </span>
                  {sheet.mfrNotes.warranty}
                </p>
              ) : null}
              {sheet.mfrNotes.usContact ? (
                <p className="mt-1 whitespace-pre-line">
                  <span className="text-muted-foreground">US contact: </span>
                  {sheet.mfrNotes.usContact}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6">
        <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Configurations</h3>
        <div className="grid gap-4 md:grid-cols-[minmax(0,15rem)_1fr]" data-testid="configuration">
          <div className="grid content-start gap-3">
            <EquipmentImage image={imageQ.data?.image} loading={sheet.hasImage && imageQ.isLoading} manufacturer={sheet.manufacturer} model={sheet.model} />
            <DimensionsImage image={imageQ.data?.dimsImage} />
          </div>
          <div className="min-w-0">
            <ConfigChips configs={sheet.configs} selected={sel} onSelect={setSel} />
            {config ? (
              <div className="mt-4">
                <RequirementsCard req={config.requirements} core={core} ctx={sheet} />
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!config}
            onClick={() => config && void copy("one", copyConfig(sheet, config))}
            data-testid="copy-config"
          >
            {copied === "one" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copied === "one" ? "Copied" : "Copy this configuration"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copy("all", copyAll(sheet))} data-testid="copy-all">
            {copied === "all" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copied === "all" ? "Copied" : "Copy all"}
          </Button>
        </div>
      </section>
      {dialog}
    </article>
  );
}
