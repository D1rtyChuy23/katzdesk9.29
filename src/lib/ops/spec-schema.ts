/**
 * The Library — data shapes for spec sheets. Pure (zod only) so node --test can import it.
 * Every field is optional except the machine identity; the UI hides empty ones.
 */
import { z } from "zod";

/** Accept what an LLM tends to send: null/"" → missing, numbers → strings. */
const text = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : undefined;
  }
  return v;
}, z.string().max(2000).optional());

const list = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (v === null || v === undefined ? [] : v), z.array(item).max(200));

const str = (max: number) =>
  z.preprocess((v) => (typeof v === "number" || typeof v === "boolean" ? String(v) : v ?? ""), z.string().trim().max(max));

export const kvSchema = z.object({ label: str(200).pipe(z.string().min(1)), value: str(2000) });

export const powerSchema = z.object({
  voltage: text,
  amps: text,
  /** Breaker size recommendation, shown under Amps (e.g. "30A 2-pole"). */
  breaker: text,
  /** 208–240 V wiring: "4-wire (2 hots, neutral, ground)" → L14, "3-wire (2 hots, ground)" → L6. */
  wires: text,
  phase: text,
  hz: text,
  plug: text,
  circuit: text,
});
export const waterSchema = z.object({ inlet: text, pressure: text, filtration: text, notes: text });
export const drainSchema = z.object({ size: text, notes: text });
export const dimensionsSchema = z.object({ width: text, depth: text, height: text, weight: text, clearance: text });

const section = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === null ? undefined : v), s.optional());

export const requirementsSchema = z.object({
  power: section(powerSchema),
  water: section(waterSchema),
  drain: section(drainSchema),
  dimensions: section(dimensionsSchema),
  other: list(kvSchema).optional(),
});

export const mfrNotesSchema = z.object({
  usContact: text,
  warranty: text,
  certifications: z
    .preprocess(
      (v) => (typeof v === "string" ? v.split(/[,;]/).map((x) => x.trim()).filter(Boolean) : v ?? []),
      z.array(z.string().trim().min(1).max(200)).max(50),
    )
    .optional(),
});

export const configSchema = z.object({
  label: z.preprocess((v) => (typeof v === "string" && v.trim() ? v : "Standard"), z.string().trim().max(200)),
  requirements: z.preprocess((v) => v ?? {}, requirementsSchema),
});

const imageField = z
  .string()
  .max(900_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Not an image")
  .nullable()
  .optional();

/** What the AI must return, and what the review form edits. */
export const specSheetSchema = z.object({
  manufacturer: z.string().trim().max(200),
  model: z.string().trim().max(200),
  category: text,
  summary: text,
  specs: list(kvSchema),
  mfrNotes: z.preprocess((v) => v ?? {}, mfrNotesSchema),
  configs: list(configSchema),
  /** Counter core hole for utility lines: "yes" | "no"; undefined = not stated. */
  coreHole: z.preprocess((v) => {
    if (v === true) return "yes";
    if (v === false) return "no";
    const t = typeof v === "string" ? v.trim().toLowerCase() : "";
    return t === "yes" || t === "no" ? t : undefined;
  }, z.enum(["yes", "no"]).optional()),
  coreDiameter: text,
  /**
   * Equipment image from the spec sheet (data URL). On save: undefined keeps the stored one,
   * null removes it, a string replaces it.
   */
  image: imageField,
  /** Dimension diagram (secondary image). Same keep / remove / replace rules as image. */
  dimsImage: imageField,
});

export type Kv = z.infer<typeof kvSchema>;
export type Power = z.infer<typeof powerSchema>;
export type Water = z.infer<typeof waterSchema>;
export type Drain = z.infer<typeof drainSchema>;
export type Dimensions = z.infer<typeof dimensionsSchema>;
export type Requirements = z.infer<typeof requirementsSchema>;
export type MfrNotes = z.infer<typeof mfrNotesSchema>;
export type SpecConfig = z.infer<typeof configSchema>;
export type SpecSheetDraft = z.infer<typeof specSheetSchema>;

export type SavedSpecSheet = SpecSheetDraft & {
  id: number;
  hasImage: boolean;
  hasDims: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function emptyDraft(): SpecSheetDraft {
  return {
    manufacturer: "",
    model: "",
    category: undefined,
    summary: undefined,
    specs: [],
    mfrNotes: { certifications: [] },
    configs: [{ label: "Standard", requirements: { water: { inlet: '3/8" compression valve' } } }],
  };
}

/**
 * Pull the JSON object out of a model reply (it may wrap it in ```json fences or add a sentence)
 * and validate it. Returns a readable error instead of throwing.
 */
export function parseExtraction(raw: string): { ok: true; data: SpecSheetDraft } | { ok: false; error: string } {
  let body = raw.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1]!.trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "No JSON object in the reply." };
  let json: unknown;
  try {
    json = JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const parsed = specSheetSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `Schema mismatch at ${first?.path.join(".") || "root"}: ${first?.message ?? "invalid"}` };
  }
  return { ok: true, data: parsed.data };
}

/** Drop empty strings/sections so saved JSON stays small and the UI can hide blanks. */
export function compactDraft(d: SpecSheetDraft): SpecSheetDraft {
  const clean = <T extends Record<string, unknown>>(o: T | undefined): T | undefined => {
    if (!o) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" ? v.trim() : v !== undefined && v !== null) out[k] = typeof v === "string" ? v.trim() : v;
    }
    return Object.keys(out).length ? (out as T) : undefined;
  };
  const kvs = (l: Kv[] | undefined) => (l ?? []).filter((k) => k.label.trim() && k.value.trim());
  return {
    manufacturer: d.manufacturer.trim(),
    model: d.model.trim(),
    category: d.category?.trim() || undefined,
    coreHole: d.coreHole,
    coreDiameter: d.coreDiameter?.trim() || undefined,
    image: d.image,
    dimsImage: d.dimsImage,
    summary: d.summary?.trim() || undefined,
    specs: kvs(d.specs),
    mfrNotes: {
      usContact: d.mfrNotes.usContact?.trim() || undefined,
      warranty: d.mfrNotes.warranty?.trim() || undefined,
      certifications: (d.mfrNotes.certifications ?? []).map((c) => c.trim()).filter(Boolean),
    },
    configs: d.configs.map((c, i) => ({
      label: c.label.trim() || `Configuration ${i + 1}`,
      requirements: {
        power: clean(c.requirements.power),
        water: clean(c.requirements.water),
        drain: clean(c.requirements.drain),
        dimensions: clean(c.requirements.dimensions),
        other: kvs(c.requirements.other),
      },
    })),
  };
}
