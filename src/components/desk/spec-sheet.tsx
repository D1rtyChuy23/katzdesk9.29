import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, Droplets, Pencil, Plug, RefreshCw, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { amps, copyAll, copyConfig, hz, phase, volts } from "@/lib/ops/spec-copy";
import type { Requirements, SavedSpecSheet, SpecConfig, SpecSheetDraft } from "@/lib/ops/spec-schema";
import { decidePlug, defaultPlugNote, nemaCode } from "@/lib/ops/spec-defaults";
import { Button } from "@/components/ui/button";
import { PlugPicture } from "./plug-face";
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
export function RequirementsCard({ req }: { req: Requirements }) {
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
        <PlugSection power={req.power} />
      </Block>
    ) : null,
    any(water) ? <Block key="w" icon={Droplets} title="Water And Drain"><Rows rows={water} /></Block> : null,
    any(dims) ? <Block key="d" icon={Ruler} title="Dimensions"><Rows rows={dims} /></Block> : null,
    any(other) ? <Block key="o" icon={ClipboardCopy} title="Other"><Rows rows={other} /></Block> : null,
  ].filter(Boolean);
  if (!sections.length) return <p className="text-sm text-muted-foreground">No requirements listed for this configuration.</p>;
  return <div className="grid gap-3 sm:grid-cols-2" data-testid="requirements-card">{sections}</div>;
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
export function PlugSection({ power }: { power: Requirements["power"] }) {
  const plug = power?.plug?.trim();
  if (!plug) return null;
  const nema = nemaCode(plug);
  if (!nema) return null;
  const d = decidePlug(power);
  const note = defaultPlugNote(power) ?? (d.note && d.plug === plug ? d.note : null);
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
}: {
  sheet: SavedSpecSheet;
  canEdit: boolean;
  onEdit: () => void;
  /** Re-apply inlet / plug / breaker defaults (Admin and Sales). */
  onRefresh?: () => void;
  refreshing?: boolean;
  onDelete: () => void;
}) {
  const [sel, setSel] = useState(0);
  const { copy, copied, dialog } = useCopy();
  useEffect(() => setSel(0), [sheet.id]);
  const config: SpecConfig | undefined = sheet.configs[Math.min(sel, sheet.configs.length - 1)];
  const certs = sheet.mfrNotes.certifications ?? [];
  const hasNotes = certs.length || sheet.mfrNotes.warranty || sheet.mfrNotes.usContact;

  return (
    <article className="rounded-xl border border-border bg-card p-5 sm:p-6" data-testid="spec-sheet">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SheetHeading sheet={sheet} />
        {canEdit ? (
          <div className="flex shrink-0 gap-2">
            {onRefresh ? (
              <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing} data-testid="spec-refresh">
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> Refresh Defaults
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
        <ConfigChips configs={sheet.configs} selected={sel} onSelect={setSel} />
        {config ? (
          <div className="mt-4">
            <RequirementsCard req={config.requirements} />
          </div>
        ) : null}
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
